# NLU training pipeline

git push customer.json into customer branch on NLU project.

CI:
generate rasa dir
build image and push

    **need to test scaling multiple customers on 1 machine

CD:
argo image watcher
docker/portainer? or just k8 rancher?

# STT training & inferrence pipeline

upload batch files to s3
upload batch.json to s3://stt/whisper/sourceName/batchName.json

```
BatchReady: Boolean
Trainer: {
    controllerID: formd | nano | xavier
    output: s3 report path
    wer_filter: {
        test: above | between value,
        train: above | between value
    },
    train_worker: {
        formd: 8
        nano: 2??
        xavier: 48??
    },
    validate_workers: {
        formd: 16
        nano: 2??
        xavier: 60??
    },
    validate_exits: [
        { train: { under: 0.01 }},
        { test: { under: 0.05 }},
        { wer: { under: 5 }},
        { wer: { consequtive: {
            test_steps: { going_up: 2 }
        }}}
        { train: { consequtive: {
            test_steps: { going_up: 2 }
        }}}
        { test: { consequtive: {
            test_steps: { going_up: 2 }
        }}}

    ]
}
```

# Infra

## GPU Host machine

    - docker python workers for AI stuff
    -

## CPU Host machine

    - docker nodejs workers
    - docker rasa?

## Infra servers

Nats servers
Minio s3 servers or cloud

Gitlab - code repo - image repo - CI solution

CI:

```

```
