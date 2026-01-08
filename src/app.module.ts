import { Module } from '@nestjs/common';
import { CICDGeneratorService } from './services/cicd-generator.service';
import { PromptService } from './services/prompt.service';
import { JenkinsFileService } from './services/jenkinsfile.service';
import { CloudProviderService } from './services/cloud-provider.service';
import { SecurityService } from './services/security.service';
import { ValidationService } from './services/validation.service';
import { NotificationService } from './services/notification.service';
import { EnvironmentService } from './services/environment.service';
import { IaCService } from './services/iac.service';
import { DashboardService } from './services/dashboard.service';
import { DockerComposeService } from './services/docker-compose.service';

@Module({
  imports: [],
  providers: [
    CICDGeneratorService,
    PromptService,
    JenkinsFileService,
    CloudProviderService,
    SecurityService,
    ValidationService,
    NotificationService,
    EnvironmentService,
    IaCService,
    DashboardService,
    DockerComposeService,
  ],
})
export class AppModule {}
