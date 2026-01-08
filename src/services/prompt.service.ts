import { Injectable } from '@nestjs/common';
import inquirer from 'inquirer';
import {
  CICDConfig,
  CloudConfig,
  ProjectConfig,
  NotificationConfig,
  ExternalService,
  EnvVariable,
  JenkinsConfig,
  NotificationPlatform,
} from '../interfaces/config.interface';
import { ValidationService } from './validation.service';

@Injectable()
export class PromptService {
  constructor(private readonly validationService: ValidationService) {}

  async collectAllConfigurations(): Promise<CICDConfig> {
    const projectConfig = await this.collectProjectConfig();
    const externalServices = await this.collectExternalServices();
    projectConfig.externalServices = externalServices;

    const cloudConfig = await this.collectCloudConfig();
    const notificationConfig = await this.collectNotificationConfig();
    const jenkinsConfig = await this.collectJenkinsConfig();

    // Collect environment variables from all sources
    const allEnvVars = this.consolidateEnvironmentVariables(
      projectConfig,
      externalServices,
    );
    jenkinsConfig.environmentVariables = allEnvVars;
    cloudConfig.deploymentConfig.environmentVariables = allEnvVars;

    return {
      project: projectConfig,
      cloud: cloudConfig,
      notifications: notificationConfig,
      jenkinsConfig,
    };
  }

  private async collectProjectConfig(): Promise<ProjectConfig> {
    const answers: Partial<ProjectConfig> = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Enter your project name:',
        default: 'my-project',
        validate: (input) => input.length > 0 || 'Project name is required',
      },
      {
        type: 'list',
        name: 'projectType',
        message: 'Select project type',
        choices: ['frontend', 'backend', 'fullstack'],
      },
      {
        type: 'list',
        name: 'language',
        message: 'Select programming language',
        choices: ['javascript', 'typescript'],
      },
      {
        type: 'input',
        name: 'repository',
        message: 'Enter Git repository URL:',
        validate: (input) => {
          try {
            return (
              this.validationService.validateGitRepository(input) ||
              'Invalid Git repository URL'
            );
          } catch (error) {
            return error.message;
          }
        },
      },
      {
        type: 'input',
        name: 'branch',
        message: 'Enter branch name to deploy:',
        default: 'master',
      },
      {
        type: 'confirm',
        name: 'hasDockerfile',
        message: 'Does your project have a Dockerfile?',
        default: true,
      },
    ]);

    if (answers.hasDockerfile) {
      const dockerConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'dockerfilePath',
          message: 'Enter Dockerfile path (relative to project root):',
          default: './Dockerfile',
        },
      ]);
      answers.dockerfilePath = dockerConfig.dockerfilePath;
      await this.validationService.validateDockerfile(answers.dockerfilePath!);
    }

    const buildAnswers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'runTests',
        message: 'Do you want to run tests during pipeline?',
        default: true,
      },
    ]);

    answers.runTests = buildAnswers.runTests;

    if (answers.runTests) {
      const testCommand = await inquirer.prompt([
        {
          type: 'input',
          name: 'testCommand',
          message: 'Enter test command:',
          default: 'npm test',
        },
      ]);
      answers.testCommand = testCommand.testCommand;
    }

    const buildConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'buildCommand',
        message: 'Enter build command:',
        default:
          answers.language === 'typescript' ? 'npm run build' : 'npm run build',
      },
    ]);
    answers.buildCommand = buildConfig.buildCommand;

    // Ask about .env file
    const envConfig = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'requiresEnvFile',
        message: 'Does your application use a .env file?',
        default: true,
      },
    ]);
    answers.requiresEnvFile = envConfig.requiresEnvFile;

    if (answers.requiresEnvFile) {
      const envPath = await inquirer.prompt([
        {
          type: 'input',
          name: 'envFilePath',
          message: 'Enter .env file path (relative to project root):',
          default: './.env',
        },
      ]);
      answers.envFilePath = envPath.envFilePath;
    }

    return answers as ProjectConfig;
  }

  private async collectExternalServices(): Promise<ExternalService[]> {
    const services: ExternalService[] = [];

    const needsServices = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'hasExternalServices',
        message:
          'Does your application use external services (database, cache, queue, etc.)?',
        default: true,
      },
    ]);

    if (!needsServices.hasExternalServices) {
      return services;
    }

    console.log("\n📦 Let's configure your external services...\n");

    let addMore = true;

    while (addMore) {
      const serviceType = await inquirer.prompt([
        {
          type: 'list',
          name: 'type',
          message: 'Select service type:',
          choices: [
            {
              name: '🗄️  Database (PostgreSQL, MongoDB, MySQL, etc.)',
              value: 'database',
            },
            { name: '⚡ Cache (Redis, Memcached)', value: 'cache' },
            { name: '📨 Message Queue (RabbitMQ, Kafka, SQS)', value: 'queue' },
            { name: '📦 Storage (S3, Azure Blob, GCS)', value: 'storage' },
            { name: '📧 Email (SMTP, SendGrid, SES)', value: 'email' },
            {
              name: '📊 Monitoring (DataDog, New Relic, Sentry)',
              value: 'monitoring',
            },
            { name: '🔧 Custom Service', value: 'custom' },
          ],
        },
      ]);

      let service: ExternalService;

      switch (serviceType.type) {
        case 'database':
          service = await this.configureDatabaseService();
          break;
        case 'cache':
          service = await this.configureCacheService();
          break;
        case 'queue':
          service = await this.configureQueueService();
          break;
        case 'storage':
          service = await this.configureStorageService();
          break;
        case 'email':
          service = await this.configureEmailService();
          break;
        case 'monitoring':
          service = await this.configureMonitoringService();
          break;
        case 'custom':
          service = await this.configureCustomService();
          break;
        default:
          // Fallback to custom service configuration for unexpected types
          service = await this.configureCustomService();
          break;
      }

      services.push(service);

      const continueAdding = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addMore',
          message: 'Add another service?',
          default: false,
        },
      ]);

      addMore = continueAdding.addMore;
    }

    return services;
  }

  private async configureDatabaseService(): Promise<ExternalService> {
    const config = await inquirer.prompt([
      {
        type: 'list',
        name: 'service',
        message: 'Select database type:',
        choices: [
          'postgresql',
          'mongodb',
          'mysql',
          'mariadb',
          'redis',
          'dynamodb',
          'cosmosdb',
        ],
      },
      {
        type: 'input',
        name: 'name',
        message: 'Enter a name for this database connection:',
        default: (answers) => `${answers.service}-main`,
      },
    ]);
    const envVars: EnvVariable[] = [];
    const dbEnvVars = await inquirer.prompt([
      {
        type: 'input',
        name: 'host',
        message: 'Database host environment variable name:',
        default: 'DB_HOST',
      },
      {
        type: 'input',
        name: 'port',
        message: 'Database port environment variable name:',
        default: 'DB_PORT',
      },
      {
        type: 'input',
        name: 'database',
        message: 'Database name environment variable name:',
        default: 'DB_NAME',
      },
      {
        type: 'input',
        name: 'username',
        message: 'Database username environment variable name:',
        default: 'DB_USERNAME',
      },
      {
        type: 'input',
        name: 'password',
        message: 'Database password environment variable name:',
        default: 'DB_PASSWORD',
      },
    ]);

    envVars.push(
      { key: dbEnvVars.host, isSecret: false, description: 'Database host' },
      { key: dbEnvVars.port, isSecret: false, description: 'Database port' },
      {
        key: dbEnvVars.database,
        isSecret: false,
        description: 'Database name',
      },
      {
        key: dbEnvVars.username,
        isSecret: true,
        description: 'Database username',
      },
      {
        key: dbEnvVars.password,
        isSecret: true,
        description: 'Database password',
      },
    );

    const connectionString = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useConnectionString',
        message: 'Do you also use a connection string/URL?',
        default: true,
      },
    ]);
    if (connectionString.useConnectionString) {
      const connStr = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: 'Connection string environment variable name:',
          default: 'DATABASE_URL',
        },
      ]);
      envVars.push({
        key: connStr.key,
        isSecret: true,
        description: 'Database connection string',
      });
    }

    return {
      type: 'database',
      name: config.name,
      service: config.service,
      envVariables: envVars,
      requiresInfrastructure: true,
    };
  }

  private async configureCacheService(): Promise<ExternalService> {
    const config = await inquirer.prompt([
      {
        type: 'list',
        name: 'service',
        message: 'Select cache type:',
        choices: ['redis', 'memcached', 'elasticache'],
      },
      {
        type: 'input',
        name: 'name',
        message: 'Enter a name for this cache connection:',
        default: (answers) => `${answers.service}-cache`,
      },
    ]);

    const envVars: EnvVariable[] = [];
    const cacheEnvVars = await inquirer.prompt([
      {
        type: 'input',
        name: 'host',
        message: 'Cache host environment variable name:',
        default: 'REDIS_HOST',
      },
      {
        type: 'input',
        name: 'port',
        message: 'Cache port environment variable name:',
        default: 'REDIS_PORT',
      },
      {
        type: 'confirm',
        name: 'requiresPassword',
        message: 'Does cache require password?',
        default: true,
      },
    ]);

    envVars.push(
      { key: cacheEnvVars.host, isSecret: false, description: 'Cache host' },
      { key: cacheEnvVars.port, isSecret: false, description: 'Cache port' },
    );

    if (cacheEnvVars.requiresPassword) {
      const password = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: 'Cache password environment variable name:',
          default: 'REDIS_PASSWORD',
        },
      ]);
      envVars.push({
        key: password.key,
        isSecret: true,
        description: 'Cache password',
      });
    }

    return {
      type: 'cache',
      name: config.name,
      service: config.service,
      envVariables: envVars,
      requiresInfrastructure: true,
    };
  }

  private async configureQueueService(): Promise<ExternalService> {
    const config = await inquirer.prompt([
      {
        type: 'list',
        name: 'service',
        message: 'Select message queue type:',
        choices: ['rabbitmq', 'kafka', 'sqs', 'redis', 'azure-service-bus'],
      },
      {
        type: 'input',
        name: 'name',
        message: 'Enter a name for this queue connection:',
        default: (answers) => `${answers.service}-queue`,
      },
    ]);

    const envVars: EnvVariable[] = [];
    const queueEnvVars = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Queue URL/connection string environment variable name:',
        default:
          config.service === 'rabbitmq'
            ? 'RABBITMQ_URL'
            : `${config.service.toUpperCase()}_URL`,
      },
    ]);
    envVars.push({
      key: queueEnvVars.url,
      isSecret: true,
      description: 'Message queue connection',
    });

    return {
      type: 'queue',
      name: config.name,
      service: config.service,
      envVariables: envVars,
      requiresInfrastructure: true,
    };
  }

  private async configureStorageService(): Promise<ExternalService> {
    const config = await inquirer.prompt([
      {
        type: 'list',
        name: 'service',
        message: 'Select storage service:',
        choices: ['s3', 'azure-blob', 'gcs', 'minio', 'spaces'],
      },
      {
        type: 'input',
        name: 'name',
        message: 'Enter a name for this storage connection:',
        default: (answers) => `${answers.service}-storage`,
      },
    ]);

    const envVars: EnvVariable[] = [];

    if (
      config.service === 's3' ||
      config.service === 'spaces' ||
      config.service === 'minio'
    ) {
      const s3EnvVars = await inquirer.prompt([
        {
          type: 'input',
          name: 'bucket',
          message: 'Bucket name environment variable:',
          default: 'S3_BUCKET',
        },
        {
          type: 'input',
          name: 'region',
          message: 'Region environment variable:',
          default: 'S3_REGION',
        },
        {
          type: 'input',
          name: 'accessKey',
          message: 'Access key environment variable:',
          default: 'S3_ACCESS_KEY',
        },
        {
          type: 'input',
          name: 'secretKey',
          message: 'Secret key environment variable:',
          default: 'S3_SECRET_KEY',
        },
      ]);

      envVars.push(
        {
          key: s3EnvVars.bucket,
          isSecret: false,
          description: 'Storage bucket name',
        },
        {
          key: s3EnvVars.region,
          isSecret: false,
          description: 'Storage region',
        },
        {
          key: s3EnvVars.accessKey,
          isSecret: true,
          description: 'Storage access key',
        },
        {
          key: s3EnvVars.secretKey,
          isSecret: true,
          description: 'Storage secret key',
        },
      );
    }

    return {
      type: 'storage',
      name: config.name,
      service: config.service,
      envVariables: envVars,
      requiresInfrastructure: false,
    };
  }

  private async configureEmailService(): Promise<ExternalService> {
    const config = await inquirer.prompt([
      {
        type: 'list',
        name: 'service',
        message: 'Select email service:',
        choices: ['smtp', 'sendgrid', 'ses', 'mailgun', 'postmark'],
      },
      {
        type: 'input',
        name: 'name',
        message: 'Enter a name for this email service:',
        default: (answers) => `${answers.service}-email`,
      },
    ]);

    const envVars: EnvVariable[] = [];

    if (config.service === 'smtp') {
      const smtpEnvVars = await inquirer.prompt([
        {
          type: 'input',
          name: 'host',
          message: 'SMTP host environment variable:',
          default: 'SMTP_HOST',
        },
        {
          type: 'input',
          name: 'port',
          message: 'SMTP port environment variable:',
          default: 'SMTP_PORT',
        },
        {
          type: 'input',
          name: 'username',
          message: 'SMTP username environment variable:',
          default: 'SMTP_USERNAME',
        },
        {
          type: 'input',
          name: 'password',
          message: 'SMTP password environment variable:',
          default: 'SMTP_PASSWORD',
        },
      ]);

      envVars.push(
        { key: smtpEnvVars.host, isSecret: false, description: 'SMTP host' },
        { key: smtpEnvVars.port, isSecret: false, description: 'SMTP port' },
        {
          key: smtpEnvVars.username,
          isSecret: true,
          description: 'SMTP username',
        },
        {
          key: smtpEnvVars.password,
          isSecret: true,
          description: 'SMTP password',
        },
      );
    } else {
      const apiKeyEnvVar = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: `${config.service.toUpperCase()} API key environment variable:`,
          default: `${config.service.toUpperCase()}_API_KEY`,
        },
      ]);
      envVars.push({
        key: apiKeyEnvVar.key,
        isSecret: true,
        description: `${config.service} API key`,
      });
    }

    return {
      type: 'email',
      name: config.name,
      service: config.service,
      envVariables: envVars,
      requiresInfrastructure: false,
    };
  }

  private async configureMonitoringService(): Promise<ExternalService> {
    const config = await inquirer.prompt([
      {
        type: 'list',
        name: 'service',
        message: 'Select monitoring service:',
        choices: ['datadog', 'newrelic', 'sentry', 'prometheus', 'grafana'],
      },
      {
        type: 'input',
        name: 'name',
        message: 'Enter a name for this monitoring service:',
        default: (answers) => `${answers.service}-monitoring`,
      },
    ]);

    const envVars: EnvVariable[] = [];
    const monitoringEnvVars = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: `${config.service.toUpperCase()} API key environment variable:`,
        default: `${config.service.toUpperCase()}_API_KEY`,
      },
    ]);
    envVars.push({
      key: monitoringEnvVars.apiKey,
      isSecret: true,
      description: `${config.service} API key`,
    });

    return {
      type: 'monitoring',
      name: config.name,
      service: config.service,
      envVariables: envVars,
      requiresInfrastructure: false,
    };
  }

  private async configureCustomService(): Promise<ExternalService> {
    const config = await inquirer.prompt([
      { type: 'input', name: 'service', message: 'Enter service name:' },
      {
        type: 'input',
        name: 'name',
        message: 'Enter a display name for this service:',
        default: (answers) => answers.service,
      },
    ]);

    const envVars: EnvVariable[] = [];
    let addMore = true;
    console.log('\nAdd environment variables for this service:\n');

    while (addMore) {
      const envVar = await inquirer.prompt([
        { type: 'input', name: 'key', message: 'Environment variable name:' },
        {
          type: 'confirm',
          name: 'isSecret',
          message: 'Is this a secret/sensitive value?',
          default: true,
        },
        { type: 'input', name: 'description', message: 'Description:' },
      ]);

      envVars.push(envVar);
      const continueAdding = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addMore',
          message: 'Add another environment variable?',
          default: false,
        },
      ]);
      addMore = continueAdding.addMore;
    }

    return {
      type: 'custom',
      name: config.name,
      service: config.service,
      envVariables: envVars,
      requiresInfrastructure: false,
    };
  }

  private consolidateEnvironmentVariables(
    projectConfig: ProjectConfig,
    externalServices: ExternalService[],
  ): { [key: string]: string } {
    const envVars: { [key: string]: string } = {};
    for (const service of externalServices) {
      for (const envVar of service.envVariables) {
        envVars[envVar.key] = envVar.description;
      }
    }
    return envVars;
  }

  private async collectCloudConfig(): Promise<CloudConfig> {
    const providerAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select cloud provider:',
        choices: ['aws', 'azure', 'gcp', 'digitalocean'],
      },
    ]);

    const provider = providerAnswer.provider;
    let credentials: any;

    switch (provider) {
      case 'aws':
        credentials = await this.collectAWSCredentials();
        break;
      case 'azure':
        credentials = await this.collectAzureCredentials();
        break;
      case 'gcp':
        credentials = await this.collectGCPCredentials();
        break;
      case 'digitalocean':
        credentials = await this.collectDOCredentials();
        break;
    }
    const deploymentConfig = await this.collectDeploymentConfig(provider);
    return {
      provider,
      credentials,
      region: credentials.region,
      instanceType: deploymentConfig.instanceType,
      deploymentConfig: deploymentConfig.config,
      managedServices: [], // Will be populated later based on external services
    };
  }
  private async collectAWSCredentials() {
    const oidcConfig = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useOIDC',
        message: 'Use OIDC Authentication (Recommended for Security)?',
        default: false,
      },
      {
        type: 'input',
        name: 'oidcRoleArn',
        message: 'Enter AWS OIDC Role ARN:',
        when: (answers) => answers.useOIDC,
        validate: (input) => input.length > 0 || 'Role ARN is required',
      },
    ]);

    const staticCredentials = await inquirer.prompt([
      {
        type: 'input',
        name: 'accessKeyId',
        message: 'Enter AWS Access Key ID:',
        when: () => !oidcConfig.useOIDC,
        validate: (input) => input.length > 0 || 'Access Key ID is required',
      },
      {
        type: 'password',
        name: 'secretAccessKey',
        message: 'Enter AWS Secret Access Key:',
        mask: '*',
        when: () => !oidcConfig.useOIDC,
        validate: (input) =>
          input.length > 0 || 'Secret Access Key is required',
      },
      {
        type: 'list',
        name: 'region',
        message: 'Select AWS region:',
        choices: [
          'us-east-1',
          'us-west-2',
          'eu-west-1',
          'ap-south-1',
          'ap-southeast-1',
        ],
        default: 'us-east-1',
      },
    ]);

    return { ...oidcConfig, ...staticCredentials };
  }

  private async collectAzureCredentials() {
    const oidcConfig = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useOIDC',
        message:
          'Use OIDC Authentication (Service Principal with Federated Credentials)?',
        default: false,
      },
    ]);

    const azureConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'subscriptionId',
        message: 'Enter Azure Subscription ID:',
        validate: (input) => input.length > 0 || 'Subscription ID is required',
      },
      {
        type: 'input',
        name: 'tenantId',
        message: 'Enter Azure Tenant ID:',
        validate: (input) => input.length > 0 || 'Tenant ID is required',
      },
      {
        type: 'input',
        name: 'clientId',
        message: 'Enter Azure Client ID:',
        validate: (input) => input.length > 0 || 'Client ID is required',
      },
      {
        type: 'password',
        name: 'clientSecret',
        message: 'Enter Azure Client Secret:',
        mask: '*',
        when: () => !oidcConfig.useOIDC,
        validate: (input) => input.length > 0 || 'Client Secret is required',
      },
      {
        type: 'list',
        name: 'region',
        message: 'Select Azure region:',
        choices: [
          'eastus',
          'westus',
          'northeurope',
          'westeurope',
          'southeastasia',
        ],
        default: 'eastus',
      },
    ]);

    return { ...oidcConfig, ...azureConfig };
  }

  private async collectGCPCredentials() {
    const oidcConfig = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useOIDC',
        message: 'Use OIDC Authentication (Workload Identity Federation)?',
        default: false,
      },
    ]);

    const gcpConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectId',
        message: 'Enter GCP Project ID:',
        validate: (input) => input.length > 0 || 'Project ID is required',
      },
      {
        type: 'input',
        name: 'keyFile',
        message: 'Enter path to GCP Service Account Key File:',
        default: './gcp-key.json',
        when: () => !oidcConfig.useOIDC,
        validate: (input) => input.length > 0 || 'Key file path is required',
      },
      {
        type: 'list',
        name: 'region',
        message: 'Select GCP region:',
        choices: ['us-central1', 'us-east1', 'europe-west1', 'asia-east1'],
        default: 'us-central1',
      },
    ]);

    return { ...oidcConfig, ...gcpConfig };
  }

  private async collectDOCredentials() {
    return await inquirer.prompt([
      {
        type: 'password',
        name: 'apiToken',
        message: 'Enter DigitalOcean API Token:',
        mask: '*',
        validate: (input) => input.length > 0 || 'API Token is required',
      },
      {
        type: 'list',
        name: 'region',
        message: 'Select DigitalOcean region:',
        choices: ['nyc1', 'nyc3', 'sfo3', 'sgp1', 'lon1', 'fra1', 'blr1'],
      },
    ]);
  }

  private async collectDeploymentConfig(provider: string) {
    const instanceChoices = {
      aws: ['t2.micro', 't2.small', 't2.medium', 't3.micro', 't3.small'],
      azure: ['Standard_B1s', 'Standard_B2s', 'Standard_D2s_v3'],
      gcp: ['e2-micro', 'e2-small', 'e2-medium', 'n1-standard-1'],
      digitalocean: ['s-1vcpu-1gb', 's-2vcpu-2gb', 's-2vcpu-4gb'],
    };

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'instanceType',
        message: 'Select instance/tier type',
        choices: instanceChoices[provider],
      },
      {
        type: 'input',
        name: 'tier',
        message: 'Enter deployment tier (e.g., dev, staging, production):',
        default: 'production',
      },
      {
        type: 'confirm',
        name: 'autoScaling',
        message: 'Enable auto-scaling?',
        default: false,
      },
      {
        type: 'list',
        name: 'deploymentStrategy',
        message: 'Select deployment strategy',
        choices: [
          { name: 'Rolling Update (default)', value: 'rolling' },
          { name: 'Blue-Green (Zero Downtime)', value: 'blue-green' },
          { name: 'Canary (Gradual Traffic)', value: 'canary' },
        ],
        default: 'rolling',
      },
    ]);

    let minInstances = 1;
    let maxInstances = 1;

    if (answers.autoScaling) {
      const scalingConfig = await inquirer.prompt([
        {
          type: 'number',
          name: 'minInstances',
          message: 'Enter minimum instances:',
          default: 1,
          validate: (input) =>
            (input !== undefined && input > 0) || 'Must be greater than 0',
        },
        {
          type: 'number',
          name: 'maxInstances',
          message: 'Enter maximum instances:',
          default: 3,
          validate: (input) =>
            (input !== undefined && input > 0) || 'Must be greater than 0',
        },
      ]);
      minInstances = scalingConfig.minInstances;
      maxInstances = scalingConfig.maxInstances;
    }

    const healthConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'healthCheckPath',
        message: 'Enter health check endpoint path:',
        default: '/health',
      },
      {
        type: 'number',
        name: 'port',
        message: 'Enter application port:',
        default: 3000,
        validate: (input) =>
          (input !== undefined && this.validationService.validatePort(input)) ||
          'Invalid port number',
      },
      {
        type: 'confirm',
        name: 'useLoadBalancer',
        message:
          'Will you use a Load Balancer / Stable DNS for this deployment?',
        default: false,
      },
      {
        type: 'input',
        name: 'loadBalancerUrl',
        message:
          'Enter your Load Balancer DNS or Domain (e.g., https://api.myapp.com):',
        when: (answers) => answers.useLoadBalancer,
        validate: (input) =>
          input.length > 0 || 'Load Balancer URL is required',
      },
    ]);

    return {
      instanceType: answers.instanceType,
      config: {
        tier: answers.tier,
        autoScaling: answers.autoScaling,
        minInstances,
        maxInstances,
        healthCheckPath: healthConfig.healthCheckPath,
        port: healthConfig.port,
        useLoadBalancer: healthConfig.useLoadBalancer,
        loadBalancerUrl: healthConfig.loadBalancerUrl,
        deploymentStrategy: answers.deploymentStrategy,
        environmentVariables: {}, // Will be populated later
      },
    };
  }

  private async collectNotificationConfig(): Promise<NotificationConfig> {
    const emailAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Enter email for notifications:',
        validate: (input) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(input) || 'Invalid email format';
        },
      },
    ]);

    const platformAnswer = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'platforms',
        message: 'Select additional notification platforms',
        choices: ['slack', 'discord', 'teams', 'telegram'],
      },
    ]);

    const platforms: NotificationPlatform[] = [];
    const webhookUrls: Record<string, string> = {};

    for (const platform of platformAnswer.platforms) {
      const webhook = await inquirer.prompt([
        {
          type: 'input',
          name: 'webhook',
          message: `Enter ${platform} webhook URL:`,
          validate: (input) =>
            input.startsWith('http') || 'Invalid webhook URL',
        },
      ]);

      platforms.push({
        type: platform as NotificationPlatform['type'],
        webhook: webhook.webhook,
      });
      webhookUrls[platform] = webhook.webhook;
    }

    return {
      email: emailAnswer.email,
      platforms,
      webhookUrls,
    };
  }

  private async collectJenkinsConfig(): Promise<JenkinsConfig> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'agentLabel',
        message: 'Enter Jenkins agent label:',
        default: 'docker',
      },
      {
        type: 'number',
        name: 'timeout',
        message: 'Enter pipeline timeout (in minutes)',
        default: 60,
      },
      {
        type: 'number',
        name: 'retryCount',
        message: 'Enter retry count for failed stages:',
        default: 2,
      },
    ]);

    return {
      agentLabel: answers.agentLabel,
      timeout: answers.timeout,
      retryCount: answers.retryCount,
      environmentVariables: {}, // Will be populated later
    };
  }
}
