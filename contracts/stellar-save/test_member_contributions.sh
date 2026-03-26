#!/bin/bash

# Test script for get_member_total_contributions function
# This script will run the specific tests for the new function

echo "Running tests for get_member_total_contributions..."
echo ""

cargo test --package stellar-save get_member_total_contributions -- --nocapture

echo ""
echo "Test execution completed!"
