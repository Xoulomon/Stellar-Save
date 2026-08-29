#!/usr/bin/env bash
# =============================================================================
# Migration Rollback Test Script
# Issue #1557: Automated testing for database migration rollback
# =============================================================================
#
# This script tests that all SQL migrations can be applied and rolled back
# cleanly without errors. It runs against a test PostgreSQL database.
#
# Usage:
#   ./database/test-migrations.sh
#
# Requirements:
#   - PostgreSQL client (psql)
#   - Test database configured (see DATABASE_URL below)
#
# Environment Variables:
#   TEST_DATABASE_URL - PostgreSQL connection string for test database
#                       Default: postgresql://postgres:postgres@localhost:5432/stellar_save_test
#
# Exit Codes:
#   0 - All migrations apply and rollback successfully
#   1 - Migration test failed
#   2 - Prerequisites not met (psql not found, database unreachable)
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"
TEST_DB_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/stellar_save_test}"

# Parse database connection
DB_USER=$(echo "$TEST_DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$TEST_DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$TEST_DB_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$TEST_DB_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$TEST_DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Execute SQL with error handling
execute_sql() {
    local sql_file="$1"
    local description="$2"
    
    if ! PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -f "$sql_file" \
        -v ON_ERROR_STOP=1 \
        --quiet \
        2>&1; then
        log_error "$description failed"
        return 1
    fi
    return 0
}

# Check if migration has a down file
has_down_migration() {
    local migration_file="$1"
    local down_file="${migration_file%.sql}.down.sql"
    
    if [[ -f "$down_file" ]]; then
        echo "$down_file"
        return 0
    fi
    return 1
}

# Test a single migration: apply then rollback
test_migration() {
    local migration_file="$1"
    local migration_name=$(basename "$migration_file")
    
    log_info "Testing migration: $migration_name"
    
    # Apply migration
    if ! execute_sql "$migration_file" "  Apply $migration_name"; then
        return 1
    fi
    log_success "  Applied $migration_name"
    
    # Check for down migration
    if down_file=$(has_down_migration "$migration_file"); then
        # Rollback migration
        if ! execute_sql "$down_file" "  Rollback $migration_name"; then
            log_error "  Rollback failed for $migration_name"
            return 1
        fi
        log_success "  Rolled back $migration_name"
    else
        log_warning "  No down migration found for $migration_name"
        log_warning "  Skipping rollback test (migration will remain applied)"
    fi
    
    return 0
}

# =============================================================================
# Prerequisite Checks
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if psql is installed
    if ! command -v psql &> /dev/null; then
        log_error "PostgreSQL client (psql) not found"
        log_info "Install with: brew install postgresql (macOS) or apt-get install postgresql-client (Linux)"
        exit 2
    fi
    log_success "PostgreSQL client found"
    
    # Check database connection
    if ! PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "SELECT 1" &> /dev/null; then
        log_error "Cannot connect to PostgreSQL server at $DB_HOST:$DB_PORT"
        log_info "Ensure PostgreSQL is running and credentials are correct"
        exit 2
    fi
    log_success "Database connection OK"
}

# =============================================================================
# Database Setup/Teardown
# =============================================================================

setup_test_database() {
    log_info "Setting up test database: $DB_NAME"
    
    # Drop and recreate test database
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "DROP DATABASE IF EXISTS $DB_NAME;" &> /dev/null || true
    
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "CREATE DATABASE $DB_NAME;" &> /dev/null
    
    log_success "Test database created"
}

cleanup_test_database() {
    log_info "Cleaning up test database..."
    
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "DROP DATABASE IF EXISTS $DB_NAME;" &> /dev/null || true
    
    log_success "Test database removed"
}

# =============================================================================
# Main Test Flow
# =============================================================================

main() {
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Database Migration Rollback Test (Issue #1557)"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    
    # Prerequisites
    check_prerequisites
    
    # Setup
    setup_test_database
    
    # Find all migrations (excluding template and .down files)
    mapfile -t migrations < <(find "$MIGRATIONS_DIR" -name "*.sql" ! -name "000_template.sql" ! -name "*.down.sql" | sort)
    
    if [[ ${#migrations[@]} -eq 0 ]]; then
        log_warning "No migrations found in $MIGRATIONS_DIR"
        cleanup_test_database
        exit 0
    fi
    
    log_info "Found ${#migrations[@]} migration(s) to test"
    echo ""
    
    # Test each migration
    failed_migrations=()
    for migration_file in "${migrations[@]}"; do
        if ! test_migration "$migration_file"; then
            failed_migrations+=("$(basename "$migration_file")")
        fi
        echo ""
    done
    
    # Cleanup
    cleanup_test_database
    
    # Report results
    echo "════════════════════════════════════════════════════════════════"
    if [[ ${#failed_migrations[@]} -eq 0 ]]; then
        log_success "All migrations passed rollback tests! ✨"
        echo ""
        exit 0
    else
        log_error "Failed migrations:"
        for failed in "${failed_migrations[@]}"; do
            echo "  - $failed"
        done
        echo ""
        exit 1
    fi
}

# Run main function
main "$@"
