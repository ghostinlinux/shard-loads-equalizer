# Project Overview

A Playwright test suite that integrates with [shard-loads-equalizer](https://www.npmjs.com/package/shard-loads-equalizer). For evenly distributed based on execution time, so each shard finishes in roughly the same duration

## Features

- Evenly distributed based on execution time.
- Tags Support : If the user wants to run tests with a specific tag, shard-loads-equalizer handles tags as well.
- Pipeline Support : Github Action and Azure DevOps

## Installation

```
npm install shard-loads-equalizer
```

### Set ENV in Local OR ENV in Github Secret Or Azure Variable Group

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

## Integration with Pipelines

- **Pipeline Files**
  - record-tests-time
  - shard-loads-equalizer

### About record-tests-time

#### This pipeline helps us to generate the test_run_statistics.json which include all the tests execution time.

### About shard-loads-equalizer

#### This pipeline helps us to actually run the test case with shard-loads-equalizer package. To distributed based on execution time, so each shard finishes in roughly the same duration.

## Integration with Github Action Pipeline

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
        echo "shardIndexArray=$shardIndexArray" >> "$GITHUB_OUTPUT"
        echo "shardTotal=$shardTotal" >> "$GITHUB_OUTPUT"

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
        echo "SHARD_INDEX=${{ matrix.shardIndex }}" >> "$GITHUB_ENV"
        echo "AUTO=true" >> "$GITHUB_ENV"  # Set AUTO environment variable to true
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
      tag:
        description: "Filter tests by tag (comma-separated for multiple tags, e.g. @one,@two)"
        required: false
        default: ""

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
          echo "shardIndexArray=$shardIndexArray" >> "$GITHUB_OUTPUT"
          echo "AUTO=false" >> "$GITHUB_ENV"

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
        run: echo "SHARD_TOTAL=${{ github.event.inputs.shardTotal }}" >> "$GITHUB_ENV"
      - name: Set tag environment variable
        run: echo "TAG=${{ github.event.inputs.tag }}" >> "$GITHUB_ENV"
      - name: Install dependencies
        run: npm install
      - name: Get test names based on shard, total shards, and optional tag
        id: getTestNames
        run: |
          test_names=$(node -e 'import("shard-loads-equalizer").then(module => console.log(module.shardLoadsEqualizer(${{ matrix.shardIndex }},${{ github.event.inputs.shardTotal }},"${{ github.event.inputs.tag }}"))).catch(err => console.error(err))')
          echo "test_names=$test_names" >> "$GITHUB_ENV"
      - name: Run Playwright tests with filtered test names
        run: |
          npx playwright test --grep "${{ env.test_names }}"
# This is Optional, my intention is to run the tests without shard loads equalizer to show the difference in execution time
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
          echo "shardIndexArray=$shardIndexArray" >> "$GITHUB_OUTPUT"
          echo "AUTO=false" >> "$GITHUB_ENV"

  run_tests_without_shard_loads_equalizer:
    needs: set_variable_for_normal_tests
    runs-on: ubuntu-latest
    timeout-minutes: 60
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
        run: echo "SHARD_TOTAL=${{ github.event.inputs.shardTotal }}" >> "$GITHUB_ENV"
      - name: Prepare test tag pattern
        run: |
          TAG_PATTERN="${{ github.event.inputs.tag }}"
          echo "TAG=${TAG_PATTERN//,/|}" >> "$GITHUB_ENV"
      - name: Install dependencies
        run: npm install
      - name: Run Playwright tests without shard loads equalizer
        run: |
          npx playwright test --shard=${{ matrix.shardIndex }}/${{ github.event.inputs.shardTotal }} --grep "${{ env.TAG }}"

```

![shard-loads-equalizer](https://github.com/user-attachments/assets/25c8ea3a-81eb-4f92-99e9-04de5067f686)


![Run WorkFlow](https://github.com/user-attachments/assets/90fd5537-af31-4578-9df4-d260b26a6fcf)



## Integration with Azure DevOps Pipeline

#### record-tests-time.yaml

```
trigger:
  branches:
    include:
      - main
  paths:
    include:
      - 'tests/**'

pr:
  branches:
    include:
      - main
  paths:
    include:
      - 'tests/**'

parameters:
  - name: shardIndex
    displayName: 'Shard Index (comma-separated values)'
    type: string
    default: '1,2,3,4,5,6,7,8'
  - name: shardTotal
    displayName: 'Shard Total'
    type: number
    default: 8

variables:
  - group: shard-load-variable-gp
  - name: shardTotal
    value: ${{ parameters.shardTotal }}
  - name: artifactName
    value: 'test_run_statistics'
  - name: AUTO
    value: 'true'
jobs:
- job: SetVariables
  displayName: 'Set shardIndex array and shardTotal'
  pool:
    vmImage: 'ubuntu-latest'
  steps:
    - task: Bash@3
      name: SetVars
      inputs:
        targetType: 'inline'
        script: |
          echo "##vso[task.setvariable variable=shardTotal]${{ parameters.shardTotal }}"

- job: RecordTestTime
  displayName: 'Record Test Time'
  dependsOn: SetVariables
  pool:
    vmImage: 'ubuntu-latest'
  timeoutInMinutes: 60
  strategy:
    parallel: ${{ parameters.shardTotal }}
  steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '18.17.0'
    - task: Npm@1
      inputs:
        command: 'install'
    - script: |
        echo "##vso[task.setvariable variable=SHARD_INDEX]$(System.JobPositionInPhase)"
      displayName: 'Set shardIndex environment variable'

    - task: Bash@3
      inputs:
        targetType: 'inline'
        script: |
          echo "The value of auto is $(AUTO)"
          if [ "$MEASURE_EXECUTION_TIME" = "true" ]; then
            npx playwright test --shard=$(System.JobPositionInPhase)/$(shardTotal) --repeat-each=1
          else
            echo "Skipping test execution because MEASURE_EXECUTION_TIME is FALSE"
            exit 1
          fi
      displayName: 'Run Playwright tests'
      env:
        MEASURE_EXECUTION_TIME: $(MEASURE_EXECUTION_TIME)
    - task: PublishPipelineArtifact@1
      inputs:
        targetPath: '$(System.DefaultWorkingDirectory)/test_run_statistics_$(System.JobPositionInPhase).json'
        artifact: '$(artifactName)_$(System.JobPositionInPhase)'
      displayName: 'Publish Test Statistics'

- job: CombineRecordTestTime
  displayName: 'Combine Record Test Time and Upload to Azure Blob'
  dependsOn: RecordTestTime
  pool:
    vmImage: 'ubuntu-latest'
  timeoutInMinutes: 60
  steps:
    - task: DownloadPipelineArtifact@2
      inputs:
        itemPattern: 'test_run_statistics_*/*.json'
        targetPath: '$(System.DefaultWorkingDirectory)'
      displayName: 'Download Test Statistics'
    - script: |
        cd '$(System.DefaultWorkingDirectory)'
        find . -type f -name "test_run_statistics_*.json" -exec mv {} . \;
        if [ -f test_run_statistics.json ]; then
            rm test_run_statistics.json
        fi
        jq -s '[.[][]]' test_run_statistics_*.json > test_run_statistics.json || echo "No JSON files found to combine"
      displayName: 'Combine JSON files'

    - script: |
        if [ -f "test_run_statistics.json" ]; then
          echo "Uploading test_run_statistics.json to Azure Blob Storage"
          az storage blob upload --account-name $AZURE_STORAGE_ACCOUNT --account-key $AZURE_STORAGE_KEY --container-name $AZURE_STORAGE_CONTAINER --file test_run_statistics.json --name test_run_statistics.json
        else
          echo "Combined JSON file not found, skipping upload."
          exit 1
        fi
      displayName: 'Upload combined JSON file to Azure Storage Blob'
      env:
        AZURE_STORAGE_ACCOUNT: $(AZURE_STORAGE_ACCOUNT)
        AZURE_STORAGE_CONTAINER: $(AZURE_STORAGE_CONTAINER)
        AZURE_STORAGE_KEY: $(AZURE_STORAGE_KEY)

```
![record-tests-time](https://github.com/user-attachments/assets/7595421a-633e-4ff1-8104-3f3793e64b53)


#### shard-loads-equalizer.yaml

```
trigger: none
parameters:
  - name: shardIndex
    displayName: 'Shard Index (comma-separated values)'
    type: string
    default: '1,2,3,4,5,6,7,8,9,10'
  - name: shardTotal
    displayName: 'Shard Total'
    type: number
    default: 10
  - name: tag
    displayName: 'Test Tags (comma-separated values)'
    type: string
    default: ' '

variables:
  - group: shard-load-variable-gp
  - name: shardTotal
    value: ${{ parameters.shardTotal }}
  - name: artifactName
    value: 'test_run_statistics'
  - name: AUTO
    value: 'true'

stages:
- stage: InitializeStage
  displayName: 'Initialize Variables'
  jobs:
  - job: SetVariables
    displayName: 'Set shardIndex array and shardTotal'
    pool:
      vmImage: 'ubuntu-latest'
    steps:
      - task: Bash@3
        name: SetVars
        inputs:
          targetType: 'inline'
          script: |
            echo "##vso[task.setvariable variable=shardTotal]${{ parameters.shardTotal }}"

- stage: TestWithShardLoads
  displayName: 'Tests With Shard Loads'
  dependsOn: InitializeStage
  jobs:
  - job: run_tests_with_shard_loads_equalizer
    displayName: 'Record Test With shard-load-equalizer'
    pool:
      vmImage: 'ubuntu-latest'
    timeoutInMinutes: 60
    strategy:
      parallel: ${{ parameters.shardTotal }}
    steps:
      - task: NodeTool@0
        inputs:
          versionSpec: '18.17.0'
      - task: Npm@1
        inputs:
          command: 'install'
      - script: |
          echo "##vso[task.setvariable variable=SHARD_INDEX]$(System.JobPositionInPhase)"
        displayName: 'Set shardIndex environment variable'

      - script: |
            az storage blob download -c $AZURE_STORAGE_CONTAINER -n test_run_statistics.json --account-name $AZURE_STORAGE_ACCOUNT --account-key $AZURE_STORAGE_KEY --file $(Pipeline.Workspace)/test_run_statistics.json
        displayName: 'Download test statistics'

      - task: PublishPipelineArtifact@1
        inputs:
          targetPath: '$(Pipeline.Workspace)/test_run_statistics.json'
          artifactName: 'test_run_statistics'

      - script: ls -la
        displayName: 'List workspace contents'

      - task: DownloadPipelineArtifact@2
        inputs:
          artifactName: 'test_run_statistics'
          targetPath: '$(System.DefaultWorkingDirectory)'

      - script: ls -la
        displayName: 'List working directory contents'

      - script: |
          echo $SHARD_INDEX
          echo '${{ parameters.shardTotal }}'
          echo '${{ parameters.tag }}'

          TAG="${{ parameters.tag }}"
          if [ ${#TAG} -eq 1 ]; then
            test_names=$(node -e 'import("shard-loads-equalizer").then(module => console.log(module.shardLoadsEqualizer($(SHARD_INDEX),${{ parameters.shardTotal }}))).catch(err => console.error(err))')
          else
            test_names=$(node -e 'import("shard-loads-equalizer").then(module => console.log(module.shardLoadsEqualizer($(SHARD_INDEX),${{ parameters.shardTotal }},"${{ parameters.tag }}"))).catch(err => console.error(err))')

          fi
          echo "##vso[task.setvariable variable=test_names;isOutput=true]$test_names"
        displayName: 'Get test names'
        name: GetTestNames


      - script: |
            echo "$(GetTestNames.test_names)"
            npx playwright test --grep "$(GetTestNames.test_names)"
        displayName: 'Run Playwright tests'
# This is Optional, my intention is to run the tests without shard loads equalizer to show the difference in execution time
- stage: PrepareNormalTests
  displayName: 'Prepare Normal Tests'
  dependsOn: TestWithShardLoads
  jobs:
  - job: set_variable_for_normal_tests
    displayName: 'Set variable for normal tests'
    pool:
      vmImage: 'ubuntu-latest'
    timeoutInMinutes: 60
    steps:
      - task: Bash@3
        name: SetVarsforNormaltests
        inputs:
          targetType: 'inline'
          script: |
            echo "##vso[task.setvariable variable=shardTotal]${{ parameters.shardTotal }}"

- stage: TestWithoutShardLoads
  displayName: 'Tests Without Shard Loads'
  dependsOn: PrepareNormalTests
  jobs:
  - job: run_tests_without_shard_loads_equalizer
    displayName: 'Run tests without shard-loads-equalizer'
    pool:
      vmImage: 'ubuntu-latest'
    timeoutInMinutes: 60
    strategy:
      parallel: ${{ parameters.shardTotal }}
    steps:
      - task: NodeTool@0
        inputs:
          versionSpec: '18.17.0'
      - task: Npm@1
        inputs:
          command: 'install'
      - script: |
          echo "##vso[task.setvariable variable=SHARD_INDEX]$(System.JobPositionInPhase)"
        displayName: 'Set shardIndex environment variable'

      - script: |
          # Prepare tag pattern (replace commas with |)
          tag_pattern="${{ parameters.tag }}"
          tag_pattern=${tag_pattern//,/|}
          echo "##vso[task.setvariable variable=TAG_PATTERN]$tag_pattern"
        displayName: 'Prepare tag pattern'
        condition: ne('${{ parameters.tag }}', '')

      - script: |
          echo $(SHARD_INDEX)/${{ parameters.shardTotal }}
          if [ -n "${{ parameters.tag }}" ]; then
            npx playwright test --shard=$(SHARD_INDEX)/${{ parameters.shardTotal }} --grep "$(TAG_PATTERN)"
          else
            npx playwright test --shard=$(SHARD_INDEX)/${{ parameters.shardTotal }}
          fi
        displayName: 'Run Playwright Tests'

```
![shard-loads-equalizer](https://github.com/user-attachments/assets/959c6708-c549-4b26-bd0e-8872d5959f90)

![Run Pipeline](https://github.com/user-attachments/assets/c75e4176-b30d-4b51-beb2-21b2358edc57)



