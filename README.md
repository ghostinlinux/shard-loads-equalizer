# Project Overview

A Playwright test suite that integrates with [shard-loads-equalizer](https://www.npmjs.com/package/shard-loads-equalizer). For evenly distributed based on execution time, so each shard finishes in roughly the same duration

## Installation

```
npm install shard-loads-equalizer
```

### Set ENV in Local OR ENV in Github Secret

```
MEASURE_EXECUTION_TIME = true
```

## Integrate shard-loads-equalizer with Test Suites

### You can create a baseTest.ts file and include the necessary setup code from my repository's baseTest.ts. This way, you won’t need to call recordTestsExecutionTime in every individual spec file. Instead, the setup in baseTest.ts will ensure that the test execution time is recorded automatically for all tests that extend or use this base file.

```
import { test } from "../baseTest";

```

##### Note :

- Your Test Case Title Must Be Unique. [ Mandatory Note ]
- Put above code block into your test case. You can take reference from this Repo Within tests directory.
- First you have to Run "record-tests-time.yml" then "shard-loads-equalizer.yml".
- When you got your "test_run_statistics.json" file then no need to run "record-tests-time.yml".
- This Pipeline "record-tests-time.yml" automatically run, when you push the changes in tests directory. If you want to trigger it manually you can.

## Integration with Github Action Pipeline

- **Pipeline Files**
  - record-tests-time.yml
  - shard-loads-equalizer.yml

### About record-tests-time.yml

#### This pipeline helps us to generate the test_run_statistics.json which include all the tests execution time.

### About shard-loads-equalizer.yml

#### This pipeline helps us to actually run the test case with shard-loads-equalizer package. To distributed based on execution time, so each shard finishes in roughly the same duration.

#### record-tests-time.yml

```
name: Record Tests Time

on:
  push:
    branches: [ main ]
    paths:
      - 'tests/**'
  pull_request:
    branches: [ main ]
    paths:
      - 'tests/**'
  workflow_dispatch:
    inputs:
      shardIndex:
        description: 'Shard Index (comma-separated values)'
        required: false
        default: '1,2,3,4,5,6,7,8'
      shardTotal:
        description: 'Shard Total'
        required: false
        default: 8

jobs:
  set_variables:
    runs-on: ubuntu-latest
    outputs:
      shardIndexArray: ${{ steps.set_vars.outputs.shardIndexArray }}
      shardTotal: ${{ steps.set_vars.outputs.shardTotal }}
    steps:
    - name: Set shardIndex array and shardTotal
      id: set_vars
      run: |
        if [[ -z "${{ github.event.inputs.shardIndex }}" ]]; then
          shardIndex='1,2,3,4,5,6,7,8'
        else
          shardIndex=${{ github.event.inputs.shardIndex }}
        fi
        if [[ -z "${{ github.event.inputs.shardTotal }}" ]]; then
          shardTotal=8
        else
          shardTotal=${{ github.event.inputs.shardTotal }}
        fi
        shardIndexArray=$(echo '["'$shardIndex'"]' | sed 's/,/","/g')
        echo "shardIndexArray=$shardIndexArray" >> $GITHUB_ENV
        echo "::set-output name=shardIndexArray::$shardIndexArray"
        echo "::set-output name=shardTotal::$shardTotal"

  record_test_time:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    needs: set_variables
    strategy:
      fail-fast: false
      matrix:
        shardIndex: ${{ fromJson(needs.set_variables.outputs.shardIndexArray) }}
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - name: Set shardIndex and AUTO environment variables
      run: |
        echo 'SHARD_INDEX=${{ matrix.shardIndex }}' >> $GITHUB_ENV
        echo 'AUTO=true' >> $GITHUB_ENV  # Set AUTO environment variable to true
    - uses: actions/setup-node@v4
      with:
        node-version: lts/*
    - name: Install dependencies
      run: npm install
    - name: Run Playwright tests
      env:
        MEASURE_EXECUTION_TIME: ${{ secrets.MEASURE_EXECUTION_TIME }}
        AUTO: true  # Ensure AUTO is set to true here
      run: |
        if [ "${{ env.MEASURE_EXECUTION_TIME }}" = "true" ] && [ "${{ env.AUTO }}" = "true" ]; then
          npx playwright test --shard=${{ matrix.shardIndex }}/${{ needs.set_variables.outputs.shardTotal }} --repeat-each=1
        else
          echo "Skipping test execution because MEASURE_EXECUTION_TIME or AUTO is set to FALSE"
          exit 1
        fi
    - name: Upload JSON File
      uses: actions/upload-artifact@v4
      with:
        name: test_run_statistics_${{ matrix.shardIndex }}
        path: test_run_statistics_${{ matrix.shardIndex }}.json

  combine_record_test_time:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    needs:
      - record_test_time
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - run: |
        if [[ -f test_run_statistics.json ]]; then
            rm test_run_statistics.json
        fi
    - name: Download JSON Files
      uses: actions/download-artifact@v4
      with:
        path: .
        pattern: test_run_statistics_*
    - name: Move JSON files to root directory
      run: |
        find . -type f -name "*.json" -exec mv {} . \;
    - uses: sergeysova/jq-action@v2
      with:
        cmd: jq -s '[.[][]]' test_run_statistics_*.json > test_run_statistics.json
    - run: rm test_run_statistics_*.json
    - uses: actions/upload-artifact@v4
      with:
        name: test_run_statistics
        path: test_run_statistics.json
    - name: Commit Json File
      uses: stefanzweifel/git-auto-commit-action@v5
      with:
         commit_message: 'Update Tests Record Time file'
         file_pattern: "*.json"

```

![record-tests-time](https://github.com/user-attachments/assets/934364fe-4b8f-4a69-82c1-f334eb1a4410)

#### shard-loads-equalizer.yml

```
name: Run Tests With Shard Loads Equalizer

on:
  workflow_dispatch:
    inputs:
      shardIndex:
        description: "Provide shard indices (comma-separated)"
        required: true
        default: "1,2,3,4,5,6,7,8,9,10"
      shardTotal:
        description: "Provide total number of shards"
        required: true
        default: 10

jobs:
  set_variable_for_shard_loads_equalizer:
    runs-on: ubuntu-latest
    outputs:
      shardIndexArray: ${{ steps.set_vars.outputs.shardIndexArray }}
    steps:
      - name: Set shardIndex array and AUTO environment variable
        id: set_vars
        run: |
          shardIndexArray=$(echo '["'${{ github.event.inputs.shardIndex }}'"]' | sed 's/,/","/g')
          echo "shardIndexArray=$shardIndexArray" >> $GITHUB_ENV
          echo "::set-output name=shardIndexArray::$shardIndexArray"
          echo "AUTO=false" >> $GITHUB_ENV  # Set AUTO to false here

  run_tests_with_shard_loads_equalizer:
    runs-on: ubuntu-latest
    needs: set_variable_for_shard_loads_equalizer
    timeout-minutes: 60
    strategy:
      fail-fast: false
      matrix:
        shardIndex: ${{ fromJson(needs.set_variable_for_shard_loads_equalizer.outputs.shardIndexArray) }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
      - name: Set shardTotal environment variable
        run: echo "SHARD_TOTAL=${{ github.event.inputs.shardTotal }}" >> $GITHUB_ENV
      - name: Install dependencies
        run: npm install
      - name: Get test names
        id: getTestNames
        run: |
          test_names=$(node -e 'import("shard-loads-equalizer").then(module => console.log(module.shardLoadsEqualizer(${{ matrix.shardIndex }},${{ github.event.inputs.shardTotal }}))).catch(err => console.error(err))')
          echo "test_names=$test_names" >> $GITHUB_ENV
      - name: Run Playwright tests
        run: |
          npx playwright test --grep "${{ env.test_names }}"


  set_variable_for_normal_tests:
    needs: run_tests_with_shard_loads_equalizer
    runs-on: ubuntu-latest
    outputs:
      shardIndexArray: ${{ steps.set_variable_for_normal_test.outputs.shardIndexArray }}
    steps:
      - name: Set shardIndex array and AUTO environment variable
        id: set_variable_for_normal_test
        run: |
          shardIndexArray=$(echo '["'${{ github.event.inputs.shardIndex }}'"]' | sed 's/,/","/g')
          echo "shardIndexArray=$shardIndexArray" >> $GITHUB_ENV
          echo "::set-output name=shardIndexArray::$shardIndexArray"
          echo "AUTO=false" >> $GITHUB_ENV  # Set AUTO to false here

  run_tests_without_shard_loads_equalizer:
    needs:
      - set_variable_for_normal_tests
    timeout-minutes: 60
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shardIndex: ${{ fromJson(needs.set_variable_for_normal_tests.outputs.shardIndexArray) }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
      - name: Set shardTotal environment variable
        run: echo "shardTotal=${{ matrix.shardTotal }}" >> $GITHUB_ENV
      - name: Install dependencies
        run: npm install
      - name: Run Playwright tests
        run: |
          npx playwright test --shard=${{ matrix.shardIndex }}/${{ github.event.inputs.shardTotal }}

```

![shard-loads-equalizer](https://github.com/user-attachments/assets/25c8ea3a-81eb-4f92-99e9-04de5067f686)

### TODO

- Build Support For Azure DevOps Pipeline
