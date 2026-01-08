import { Injectable } from '@nestjs/common';
import { CloudConfig } from '../interfaces/config.interface';

@Injectable()
export class CloudProviderService {
  generateAWSDeploymentScript(
    config: CloudConfig,
    dockerImageName: string,
  ): string {
    const { region, deploymentConfig, credentials } = config;
    const awsCredentials = credentials as any;

    let authLogic = `
    #AWS Deployment Configuration
    aws configure set aws_access_key_id \${AWS_ACCESS_KEY_ID}
    aws configure set aws_secret_access_key \${AWS_SECRET_ACCESS_KEY}
    aws configure set region ${region}`;

    if (awsCredentials.useOIDC && awsCredentials.oidcRoleArn) {
      authLogic = `
    # AWS OIDC Authentication
    echo "Authenticating via OIDC..."
    export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" \\
    $(aws sts assume-role-with-web-identity \\
    --role-arn ${awsCredentials.oidcRoleArn} \\
    --role-session-name JenkinsSession \\
    --web-identity-token \${AWS_WEB_IDENTITY_TOKEN} \\
    --query "Credentials.[AccessKeyId,SecretAccessKey,SessionToken]" \\
    --output text))
    aws configure set region ${region}`;
    }

    return `
    ${authLogic}

    #Create/Update ECS Cluster
    aws ecs create-cluster --cluster-name ${dockerImageName}-cluster || true

    #Register Task Definition
    cat >task-definition.json << EOF
    {
        "family": "${dockerImageName}",
        "networkMode": "awsvpc",
        "requiresCompatibility": ["FARGATE"],
        "cpu": "256",
        "memory": "512",
        "containerDefinitions": [
        {
            "name": "${dockerImageName}",
            "image": "\${DOCKER_IMAGE}",
            "portMappings": [
                {
                    "containerPort": ${deploymentConfig.port},
                    "protocol": "tcp"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/${dockerImageName}",
                    "awslogs-region": "${region}",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        }],
        "healthCheck": {
            "command": ["CMD-SHELL", "curl -f http://localhost:${
              deploymentConfig.port
            }${deploymentConfig.healthCheckPath} || exit 1"],
            "interval": 30,
            "timeout": 5,
            "retries": 3
        }
    }
    EOF

    aws ecs register-task-definition --cli-input-json file://task-definition.json

    # Check if ECS service exists
    SERVICE_EXISTS=$(aws ecs describe-services --cluster ${dockerImageName}-cluster --services ${dockerImageName}-service --query 'services[0].status' --output text || echo "MISSING")

    if [ "$SERVICE_EXISTS" != "ACTIVE" ]; then
        echo "Creating new ECS service..."
        aws ecs create-service \\
            --cluster ${dockerImageName}-cluster \\
            --service-name ${dockerImageName}-service \\
            --task-definition ${dockerImageName} \\
            --desired-count ${deploymentConfig.minInstances || 1} \\
            --launch-type FARGATE \\
            --network-configuration "awsvpcConfiguration={subnets=[\${SUBNET_IDS}], securityGroups=[\${SECURITY_GROUP_IDS}], assignPublicIp=ENABLED}"
    else
        echo "Updating existing ECS service with ${
          deploymentConfig.deploymentStrategy
        } strategy..."
        if [ "${deploymentConfig.deploymentStrategy}" == "blue-green" ]; then
            echo "Performing Blue-Green deployment..."
            # Simulating blue-green by creating/updating a 'green' version
            aws ecs update-service --cluster ${dockerImageName}-cluster --service ${dockerImageName}-service --task-definition ${dockerImageName} --force-new-deployment
        elif [ "${deploymentConfig.deploymentStrategy}" == "canary" ]; then
            echo "Performing Canary deployment (10% traffic)..."
            aws ecs update-service --cluster ${dockerImageName}-cluster --service ${dockerImageName}-service --task-definition ${dockerImageName} --desired-count $(( ${
      deploymentConfig.minInstances || 1
    } + 1 ))
        else
            aws ecs update-service --cluster ${dockerImageName}-cluster --service ${dockerImageName}-service --task-definition ${dockerImageName} --force-new-deployment
        fi
    fi

    ${this.generateDeployedUrlExport(
      deploymentConfig,
      `TASK_ARN=$(aws ecs list-tasks --cluster ${dockerImageName}-cluster --service-name ${dockerImageName}-service --query 'taskArns[0]' --output text)
    ENI_ID=$(aws ecs describe-tasks --cluster ${dockerImageName}-cluster --tasks $TASK_ARN --query 'tasks[0].attachments[0].details[?name==\`networkInterfaceId\`].value' --output text)
    PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --query 'NetworkInterfaces[0].Association.PublicIp' --output text)
    export DEPLOYED_URL="http://$PUBLIC_IP:${deploymentConfig.port}"`,
    )}
    `;
  }

  generateAzureDeploymentScript(
    config: CloudConfig,
    dockerImageName: string,
  ): string {
    const { deploymentConfig, credentials } = config;
    const azureCredentials = credentials as any;

    let authLogic = `
    # Azure Deployment Configuration
    az login --service-principal \\
        -u \${AZURE_CLIENT_ID} \\
        -p \${AZURE_CLIENT_SECRET} \\
        -t \${AZURE_TENANT_ID}`;

    if (azureCredentials.useOIDC) {
      authLogic = `
    # Azure OIDC Authentication
    echo "Authenticating via OIDC..."
    az login --service-principal \\
        -u \${AZURE_CLIENT_ID} \\
        -t \${AZURE_TENANT_ID} \\
        --federated-token \${AZURE_FEDERATED_TOKEN}`;
    }

    return `
    ${authLogic}
    
    az account set --subscription \${AZURE_SUBSCRIPTION_ID}

    # Create Resource Group
    az group create --name \${RESOURCE_GROUP_NAME} --location \${REGION}
    
    # Create Container Instance
    az container create \\
        --resource-group \${RESOURCE_GROUP} \\
        --name ${dockerImageName} \\
        --image \${DOCKER_IMAGE} \\
        --cpu 1 \\
        --memory 1.5 \\
        --registry-login-server \${ACR_LOGIN_SERVER} \\
        --registry-username \${ACR_USERNAME} \\
        --registry-password \${ACR_PASSWORD} \\
        --dns-name-label ${dockerImageName} \\
        --ports ${deploymentConfig.port} \\
        --environment-variables NODE_ENV=production \\
        --restart-policy Always

    ${this.generateDeployedUrlExport(
      deploymentConfig,
      `export DEPLOYED_URL="http://${dockerImageName}.\${AZURE_REGION}.azurecontainer.io:${deploymentConfig.port}"`,
    )}
    `;
  }

  generateGCPDeploymentScript(
    config: CloudConfig,
    dockerImageName: string,
  ): string {
    const { region, deploymentConfig, credentials } = config;
    const gcpCredentials = credentials as any;

    let authLogic = `
    # GCP Deployment Configuration
    gcloud auth activate-service-account --key-file=\${GCP_KEY_FILE}
    gcloud config set project \${GCP_PROJECT_ID}
    gcloud config set compute/region ${region}`;

    if (gcpCredentials.useOIDC) {
      authLogic = `
    # GCP OIDC Authentication
    echo "Authenticating via OIDC..."
    echo \${GCP_OIDC_TOKEN} > oidc_token.txt
    gcloud auth login --cred-file=oidc_token.txt
    gcloud config set project \${GCP_PROJECT_ID}
    gcloud config set compute/region ${region}`;
    }

    return `
    ${authLogic}

    # Deploy to Cloud Run
    gcloud run deploy ${dockerImageName} \\
        --image \${DOCKER_IMAGE} \\
        --platform managed \\
        --port ${deploymentConfig.port} \\
        --memory 512Mi \\
        --cpu 1 \\
        --min-instances ${deploymentConfig.minInstances || 0} \\
        --max-instances ${deploymentConfig.maxInstances || 1} \\
        --set-env-vars NODE_ENV=production \\
        --region ${region} \\
        --format='value(status.url)' > gcp_url.txt
    
    ${this.generateDeployedUrlExport(
      deploymentConfig,
      `export DEPLOYED_URL=$(cat gcp_url.txt)`,
    )}
    `;
  }

  generateDigitalOceanDeploymentScript(
    config: CloudConfig,
    dockerImageName: string,
  ): string {
    const { region, deploymentConfig } = config;

    return `
    # DigitalOcean Deployment Configuration
    doctl auth init --access-token \${DO_API_TOKEN}

    #Create App Platform APP
    cat > app-spec.yaml << EOF
    name: ${dockerImageName}
    region: ${region}
    services:
        - name: ${dockerImageName}
          image: 
            registry-type: DOCKER_HUB
            repository: \${DOCKER_IMAGE}
          http_port: ${deploymentConfig.port}
          instance_count: ${deploymentConfig.minInstances || 1}
          instance_size_slug: basic-xxs
          health-check:
            http_path: ${deploymentConfig.healthCheckPath}
          routes:
            - path: /

    EOF

    # Create or update app
    APP_ID=\$(doctl apps list --format ID --no-header | head -n 1)

    if [ -z "\$APP_ID" ]; then
        doctl apps create --spec app-spec.yaml
    else
        doctl apps update \$APP_ID --spec app-spec.yaml
    fi

    ${this.generateDeployedUrlExport(
      deploymentConfig,
      `export DEPLOYED_URL=$(doctl apps get \$APP_ID --format DefaultIngress --no-header)`,
    )}
    `;
  }

  generateDeploymentScript(
    config: CloudConfig,
    dockerImageName: string,
  ): string {
    switch (config.provider) {
      case 'aws':
        return this.generateAWSDeploymentScript(config, dockerImageName);
      case 'azure':
        return this.generateAzureDeploymentScript(config, dockerImageName);
      case 'gcp':
        return this.generateGCPDeploymentScript(config, dockerImageName);
      case 'digitalocean':
        return this.generateDigitalOceanDeploymentScript(
          config,
          dockerImageName,
        );
      default:
        throw new Error(`Unsupported cloud provider: ${config.provider}`);
    }
  }

  generateCredentialsEnvironmentVariables(config: CloudConfig): string {
    const { provider, credentials } = config;

    switch (provider) {
      case 'aws': {
        const awsCreds = credentials as any;
        if (awsCreds.useOIDC) {
          return `
      environment {
        AWS_WEB_IDENTITY_TOKEN = credentials('aws-oidc-token')
      }`;
        }
        return `
      environment {
        AWS_ACCESS_KEY_ID = credentials('aws-access-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-access-key')
        AWS_REGION = '${credentials['region']}'
      }`;
      }
      case 'azure': {
        const azCreds = credentials as any;
        const baseEnv = `
        AZURE_SUBSCRIPTION_ID = credentials('azure-subscription-id')
        AZURE_TENANT_ID = credentials('azure-tenant-id')
        AZURE_CLIENT_ID = credentials('azure-client-id')`;

        if (azCreds.useOIDC) {
          return `
      environment {${baseEnv}
        AZURE_FEDERATED_TOKEN = credentials('azure-federated-token')
      }`;
        }
        return `
      environment {${baseEnv}
        AZURE_CLIENT_SECRET = credentials('azure-client-secret')
      }`;
      }
      case 'gcp': {
        const gcpCreds = credentials as any;
        if (gcpCreds.useOIDC) {
          return `
      environment {
        GCP_PROJECT_ID = credentials('gcp-project-id')
        GCP_OIDC_TOKEN = credentials('gcp-oidc-token')
      }`;
        }
        return `
      environment {
        GCP_PROJECT_ID = credentials('gcp-project-id')
        GCP_KEY_FILE = credentials('gcp-key-file')
      }`;
      }
      case 'digitalocean':
        return `
            environment {
                DO_API_TOKEN = credentials('do-api-token')
            }`;
      default:
        return '';
    }
  }

  private generateDeployedUrlExport(
    deploymentConfig: any,
    defaultUrlScript: string,
  ): string {
    if (deploymentConfig.useLoadBalancer && deploymentConfig.loadBalancerUrl) {
      return `
    export DEPLOYED_URL="${deploymentConfig.loadBalancerUrl}"
    echo "DEPLOYED_URL=\$DEPLOYED_URL" >> deployment.env
    echo "Deployment completed. Reachable at Load Balancer: \$DEPLOYED_URL"`;
    }

    return `
    ${defaultUrlScript}
    echo "DEPLOYED_URL=\$DEPLOYED_URL" >> deployment.env
    echo "Deployment completed. Reachable at: \$DEPLOYED_URL"`;
  }
}
