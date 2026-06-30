"""
AWS Secrets Manager rotation Lambda for PostgreSQL RDS credentials.
Based on AWS-provided PostgreSQL rotation template with single-user strategy.
"""

import json
import logging
import os
import boto3
import psycopg2

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Secrets Manager rotation handler for PostgreSQL.
    
    Args:
        event: Lambda event containing SecretId, Token, and Step
        context: Lambda context object
    """
    service_client = boto3.client('secretsmanager', endpoint_url=os.environ.get('SECRETS_MANAGER_ENDPOINT'))
    
    arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']
    
    logger.info(f"Executing rotation step: {step} for secret: {arn}")
    
    # Dispatch to the appropriate step handler
    if step == "createSecret":
        create_secret(service_client, arn, token)
    elif step == "setSecret":
        set_secret(service_client, arn, token)
    elif step == "testSecret":
        test_secret(service_client, arn, token)
    elif step == "finishSecret":
        finish_secret(service_client, arn, token)
    else:
        raise ValueError(f"Invalid step: {step}")


def create_secret(service_client, arn, token):
    """
    Generate a new password and store it with AWSPENDING label.
    """
    # Check if secret version with AWSPENDING label already exists
    try:
        service_client.get_secret_value(SecretId=arn, VersionId=token, VersionStage="AWSPENDING")
        logger.info("createSecret: AWSPENDING version already exists")
        return
    except service_client.exceptions.ResourceNotFoundException:
        pass
    
    # Get current secret value
    current_secret = service_client.get_secret_value(SecretId=arn, VersionStage="AWSCURRENT")
    secret_dict = json.loads(current_secret['SecretString'])
    
    # Generate new password
    new_password = service_client.get_random_password(
        PasswordLength=32,
        ExcludeCharacters='/@"\'\\'
    )
    
    # Create new secret version with new password
    secret_dict['password'] = new_password['RandomPassword']
    
    service_client.put_secret_value(
        SecretId=arn,
        ClientRequestToken=token,
        SecretString=json.dumps(secret_dict),
        VersionStages=['AWSPENDING']
    )
    
    logger.info("createSecret: Successfully created new secret version with AWSPENDING label")


def set_secret(service_client, arn, token):
    """
    Update the database password to the new AWSPENDING value.
    """
    # Get pending and current secrets
    pending_secret = service_client.get_secret_value(SecretId=arn, VersionId=token, VersionStage="AWSPENDING")
    pending_dict = json.loads(pending_secret['SecretString'])
    
    current_secret = service_client.get_secret_value(SecretId=arn, VersionStage="AWSCURRENT")
    current_dict = json.loads(current_secret['SecretString'])
    
    # Connect to database using current credentials
    conn = get_connection(current_dict)
    
    try:
        with conn.cursor() as cursor:
            # Update the password for the user
            alter_sql = f"ALTER USER {pending_dict['username']} WITH PASSWORD %s"
            cursor.execute(alter_sql, (pending_dict['password'],))
            conn.commit()
            logger.info(f"setSecret: Successfully updated password for user {pending_dict['username']}")
    finally:
        conn.close()


def test_secret(service_client, arn, token):
    """
    Test that the new AWSPENDING credentials work.
    """
    # Get pending secret
    pending_secret = service_client.get_secret_value(SecretId=arn, VersionId=token, VersionStage="AWSPENDING")
    pending_dict = json.loads(pending_secret['SecretString'])
    
    # Test connection with new credentials
    conn = get_connection(pending_dict)
    
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            if result[0] != 1:
                raise ValueError("Test query failed")
            logger.info("testSecret: Successfully validated new credentials")
    finally:
        conn.close()


def finish_secret(service_client, arn, token):
    """
    Move AWSCURRENT label to the new secret version.
    """
    # Get current version
    metadata = service_client.describe_secret(SecretId=arn)
    current_version = None
    
    for version_id, stages in metadata['VersionIdsToStages'].items():
        if "AWSCURRENT" in stages:
            if version_id == token:
                logger.info("finishSecret: Version already marked as AWSCURRENT")
                return
            current_version = version_id
            break
    
    # Move AWSCURRENT label to new version
    service_client.update_secret_version_stage(
        SecretId=arn,
        VersionStage="AWSCURRENT",
        MoveToVersionId=token,
        RemoveFromVersionId=current_version
    )
    
    logger.info(f"finishSecret: Successfully moved AWSCURRENT label to version {token}")


def get_connection(secret_dict):
    """
    Create a PostgreSQL database connection.
    
    Args:
        secret_dict: Dictionary containing connection parameters
        
    Returns:
        psycopg2 connection object
    """
    return psycopg2.connect(
        host=secret_dict['host'],
        port=secret_dict['port'],
        database=secret_dict['dbname'],
        user=secret_dict['username'],
        password=secret_dict['password'],
        connect_timeout=5
    )
