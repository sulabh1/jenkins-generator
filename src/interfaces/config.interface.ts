export interface ProjectConfig {
  projectName: string;
  projectType: 'frontend' | 'backend' | 'fullstack';
  language: 'javascript' | 'typescript';
  repository: string;
  branch: string;
  hasDockerfile: boolean;
  dockerfilePath?: string;
  runTests: boolean;
  testCommand?: string;
  buildCommand?: string;
  requiresEnvFile: boolean;
  envFilePath?: string;
  externalServices: ExternalService[];
}

export interface ExternalService {
  type:
    | 'database'
    | 'cache'
    | 'queue'
    | 'storage'
    | 'email'
    | 'monitoring'
    | 'custom';
  name: string;
  service: string; // e.g., 'postgresql', 'mongodb', 'redis', 'rabbitmq', 's3', 'smtp'
  envVariables: EnvVariable[];
  connectionString?: string;
  requiresInfrastructure: boolean;
}

export interface CloudConfig {
  provider: 'aws' | 'azure' | 'gcp' | 'digitalocean';
  credentials:
    | AWSCredentials
    | AzureCredentials
    | GCPCredentials
    | DOCredentials;
  region: string;
  instanceType: string;
  deploymentConfig: DeploymentConfig;
  managedServices: ManagedService[];
}

export interface ManagedService {
  type: 'database' | 'cache' | 'queue' | 'storage';
  service: string;
  tier: string;
  autoProvision: boolean;
  existingResourceId?: string;
}

export interface EnvVariable {
  key: string;
  value?: string;
  isSecret: boolean;
  description: string;
}

export interface AWSCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  region: string;
  useOIDC: boolean;
  oidcRoleArn?: string;
}

export interface AzureCredentials {
  subscriptionId: string;
  clientId: string;
  clientSecret?: string;
  tenantId: string;
  useOIDC: boolean;
}

export interface GCPCredentials {
  projectId: string;
  keyFile?: string;
  region: string;
  useOIDC: boolean;
}

export interface DOCredentials {
  apiToken: string;
  region: string;
}

export interface DeploymentConfig {
  tier: string;
  autoScaling: boolean;
  minInstances?: number;
  maxInstances?: number;
  healthCheckPath: string;
  port: number;
  useLoadBalancer: boolean;
  loadBalancerUrl?: string;
  deploymentStrategy: 'rolling' | 'blue-green' | 'canary';
  environmentVariables: { [key: string]: string };
}

export interface NotificationConfig {
  email: string;
  platforms: NotificationPlatform[];
  webhookUrls?: { [key: string]: string };
}

export interface NotificationPlatform {
  type: 'slack' | 'discord' | 'teams' | 'telegram';
  webhook?: string;
  apiKey?: string;
}

export interface CICDConfig {
  project: ProjectConfig;
  cloud: CloudConfig;
  notifications: NotificationConfig;
  jenkinsConfig: JenkinsConfig;
}

export interface JenkinsConfig {
  agentLabel: string;
  timeout: number;
  retryCount: number;
  environmentVariables: { [key: string]: string };
}
