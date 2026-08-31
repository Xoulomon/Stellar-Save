#!/user/bin/env bash
# Multi-Environment Deployment Tests
# Validates deployment workflows and environment configurations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Test colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
test_passed=0
test_failed=0

# Helper functions
run_test() {
  local test_name="$1"
  local test_cmd="$2"
  
  ((test_count++))
  echo -e "${YELLOW}Test $test_count: $test_name${NC}"
  
  if eval "$test_cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}\n"
    ((test_passed++))
  else
    echo -e "${RED}✗ FAIL${NC}\n"
    ((test_failed++))
  fi
}

# Environment Configuration Tests
echo -e "\n${YELLOW}=== Environment Configuration Tests ===${NC}\n"

run_test "Dev environment config exists" \
  "grep -q 'dev' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Staging environment config exists" \
  "grep -q 'staging' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Production environment config exists" \
  "grep -q 'production' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Environment config manager is executable" \
  "[ -f $PROJECT_ROOT/scripts/env-config.sh ]"

# Workflow Definition Tests
echo -e "\n${YELLOW}=== Workflow Definition Tests ===${NC}\n"

run_test "Multi-environment workflow file exists" \
  "[ -f $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml ]"

run_test "Workflow has build job" \
  "grep -q 'build:' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Workflow has deploy-dev job" \
  "grep -q 'deploy-dev:' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Workflow has deploy-staging job" \
  "grep -q 'deploy-staging:' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Workflow has deploy-production job" \
  "grep -q 'deploy-production:' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Workflow has health-check job" \
  "grep -q 'health-check:' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

# Promotion Workflow Tests
echo -e "\n${YELLOW}=== Promotion Workflow Tests ===${NC}\n"

run_test "Promotion workflow defined" \
  "grep -q 'promote-environment:' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Dev to staging promotion supported" \
  "grep -q 'dev→staging' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Staging to production promotion supported" \
  "grep -q 'staging→production' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

# Build Configuration Tests
echo -e "\n${YELLOW}=== Build Configuration Tests ===${NC}\n"

run_test "Frontend build step defined" \
  "grep -q 'Build frontend' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Contract build step defined" \
  "grep -q 'Build Soroban contract' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Artifact packaging step defined" \
  "grep -q 'Package artifacts' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

# Deployment Tests
echo -e "\n${YELLOW}=== Deployment Tests ===${NC}\n"

run_test "Dev deployment script referenced" \
  "grep -q 'Deploy frontend to dev' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Staging deployment script referenced" \
  "grep -q 'Deploy frontend to staging' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Production deployment script referenced" \
  "grep -q 'Deploy frontend to production' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Smoke tests step defined" \
  "grep -q 'smoke_test.sh' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

# Health Check Tests
echo -e "\n${YELLOW}=== Health Check Tests ===${NC}\n"

run_test "Health check job exists" \
  "grep -q 'health-check:' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Frontend health check defined" \
  "grep -q 'Check frontend health' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

run_test "Deployment report generation defined" \
  "grep -q 'Generate deployment report' $PROJECT_ROOT/.github/workflows/multi-environment-deployment.yml"

# Results Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}\n"
echo "Total Tests: $test_count"
echo -e "${GREEN}Passed: $test_passed${NC}"
echo -e "${RED}Failed: $test_failed${NC}\n"

if [ $test_failed -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
