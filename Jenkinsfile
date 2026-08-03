pipeline {
    agent any

    options {
        timeout(time: 15, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Validate YAML') {
            steps {
                sh '''
                    python3 -c "
import yaml, glob, sys
errors = []
for f in sorted(glob.glob('**/*.yaml', recursive=True)):
    skip = ['.github', 'node_modules', 'skeleton', 'examples']
    if any(s in f for s in skip):
        continue
    try:
        list(yaml.safe_load_all(open(f)))
    except Exception as e:
        errors.append(f + ': ' + str(e))
if errors:
    print('YAML syntax errors:')
    [print(' ', e) for e in errors]
    sys.exit(1)
print('All YAML files valid (' + str(len(glob.glob('**/*.yaml', recursive=True))) + ' scanned)')
"
                '''
            }
        }

        stage('Check NodePort conflicts') {
            steps {
                sh '''
                    echo "Scanning for duplicate NodePorts..."
                    grep -r "nodePort:" apps/ services/ infrastructure/ --include="*.yaml" -h \
                      | grep -oE '[0-9]+' \
                      | sort \
                      | uniq -d \
                      | while read port; do
                          echo "CONFLICT: nodePort $port is used more than once"
                          grep -r "nodePort: $port" apps/ services/ infrastructure/ --include="*.yaml" -l
                        done
                    echo "NodePort check complete"
                '''
            }
        }
    }

    post {
        success {
            echo "Build ${env.BUILD_NUMBER} passed on ${env.BRANCH_NAME}"
        }
        failure {
            echo "Build ${env.BUILD_NUMBER} FAILED on ${env.BRANCH_NAME}"
        }
    }
}
