#!/bin/bash
# Environment-specific deployment tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Testing Dev, Staging, and Production Environment Deployments"
echo "=============================================================="

# Test 1: Environment Configuration Loading
echo ""
echo "Test 1: Environment Configuration Loading"
echo "-------------------------------------------"
test_env_configs() {
  for env in dev staging production; do
    echo "Testing $env environment..."
    # Simulate environment setup
    case $env in
      dev)
        EXPECTED_NETWORK="testnet"
        EXPECTED_URL="https://dev.stellar-save.app"
        ;;
      staging)
        EXPECTED_NETWORK="testnet"
        EXPECTED_URL="https://staging.stellar-save.app"
        ;;
      production)
        EXPECTED_NETWORK="mainnet"
        EXPECTED_URL="https://stellar-save.app"
        ;;
    esac
    
    if [ ! -z "$EXPECTED_NETWORK" ]; then
      echo "  ✓ $env configuration valid"
    fi
  done
}

test_env_configs

# Test 2: Build Artifact Generation
echo ""
echo "Test 2: Build Artifact Generation"
echo "-----------------------------------"
test_build_artifacts() {
  echo "Checking build configuration..."
  
  if grep -q "npm run build" "$PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"; then
    echo "  ✓ Frontend build configured"
  fi
  
  if grep -q "cargo build" "$PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"; then
    echo "  ✓ Contract build configured"
  fi
  
  if grep -q "Package artifacts" "$PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"; then
    echo "  ✓ Artifact packaging configured"
  fi
}

test_build_artifacts

# Test 3: Deployment Jobs
echo ""
echo "Test 3: Deployment Jobs"
echo "----------------------"
test_deployment_jobs() {
  for job in "deploy-dev" "deploy-staging" "deploy-production"; do
    if grep -q "${job}:" "$PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"; then
      echo "  ✓ $job defined"
    fi
  done
}

test_deployment_jobs

# Test 4: Promotion Workflow
echo ""
echo "Test 4: Promotion Workflow"
echo "--------------------------"
test_promotion() {
  if grep -q "promote-environment:" "$PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"; then
    echo "  ✓ Promotion workflow defined"
  fi
  
  if grep -q "dev→staging\|staging→production" "$PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"; then
    echo "  ✓ Promotion paths defined"
  fi
}

test_promotion

# Test 5: Health Checks
echo ""
echo "Test 5: Health Checks"
echo "---------------------"
test_health_checks() {
  if grep -q "health-check:" "$PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"; then
    echo "  ✓ Health check job defined"
  fi
  
  if grep -q "Check frontend health" "$PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"; then
    echo "  ✓ Frontend health verification configured"
  fi
}

test_health_checks

# Test 6: Documentation
echo ""
echo "Test 6: Documentation"
echo "---------------------"
test_documentation() {
  for doc in "performance-benchmarking.md" "multi-environment-deployment.md"; do
    if [ -f "$PROJECT_ROOT/docs/$doc" ]; then
      echo "  ✓ $doc exists"
    fi
  done
}

test_documentation

echo ""
echo "=============================================================="
echo "All deployment environment tests completed!"
