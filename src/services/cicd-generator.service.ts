import { Injectable } from '@nestjs/common';
import { PromptService } from './prompt.service';
import inquirer from 'inquirer';
import { JenkinsFileService } from './jenkinsfile.service';
import { SecurityService } from './security.service';
import { ValidationService } from './validation.service';
import { EnvironmentService } from './environment.service';
import { IaCService } from './iac.service';
import { DashboardService } from './dashboard.service';
import { DockerComposeService } from './docker-compose.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';

@Injectable()
export class CICDGeneratorService {
  constructor(
    private readonly promptService: PromptService,
    private readonly jenkinsFileService: JenkinsFileService,
    private readonly securityService: SecurityService,
    private readonly validationService: ValidationService,
    private readonly environmentService: EnvironmentService,
    private readonly iacService: IaCService,
    private readonly dashboardService: DashboardService,
    private readonly dockerComposeService: DockerComposeService,
  ) {}

  async run(): Promise<void> {
    try {
      console.log(chalk.cyan('Starting CICD configuration...\n'));

      // Validate project structure
      const spinner = ora('Validating project structure...').start();
      try {
        const packageJson = await this.validationService.readPackageJson();
        spinner.succeed('Project structure validated');
        console.log(chalk.gray(`Found project: ${packageJson.name}\n`));
      } catch (error) {
        spinner.fail('Project validation failed');
        throw error;
      }

      // Collect all configurations
      console.log(chalk.yellow('Please provide the following information:\n'));

      const configPath = path.resolve(
        process.cwd(),
        'jenkins-generator-config.json',
      );
      let config: any;

      if (await fs.pathExists(configPath)) {
        const loadConfig = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'usePreset',
            message:
              'Found existing jenkins-generator-config.json. Do you want to load it?',
            default: true,
          },
        ]);

        if (loadConfig.usePreset) {
          config = await fs.readJSON(configPath);
          console.log(chalk.green('Configuration loaded successfully!\n'));
        }
      }

      if (!config) {
        config = await this.promptService.collectAllConfigurations();

        const saveConfig = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'savePreset',
            message:
              'Do you want to save this configuration as a preset (jenkins-generator-config.json)?',
            default: true,
          },
        ]);

        if (saveConfig.savePreset) {
          await fs.writeJSON(configPath, config, { spaces: 2 });
          console.log(
            chalk.green(
              'Configuration saved to jenkins-generator-config.json\n',
            ),
          );
        }
      }

      // Generate Jenkinsfile
      const generatingSpinner = ora('Generating Jenkinsfile...').start();
      const jenkinsfile = this.jenkinsFileService.generateJenkinsfile(config);
      generatingSpinner.succeed('Jenkinsfile generated');

      // Generate supporting files
      const credentialsGuide =
        this.jenkinsFileService.generateCredentialsSetupGuide(config);
      const readme = this.jenkinsFileService.generateReadme(config);

      // Generate .env.template if external services are configured
      let envTemplate = '';
      if (
        config.project.externalServices &&
        config.project.externalServices.length > 0
      ) {
        envTemplate = this.environmentService.generateEnvFileTemplate(
          config.project.externalServices,
        );
      }

      // Generate IaC
      const iacSpinner = ora('Generating Infrastructure as Code...').start();
      const terraformConfig = this.iacService.generateTerraformConfig(
        config.cloud,
        config.project.projectName,
      );
      iacSpinner.succeed('Infrastructure as Code generated');

      // Generate Dashboard
      const dashboardSpinner = ora(
        'Generating Deployment Dashboard...',
      ).start();
      const dashboard =
        this.dashboardService.generateDeploymentDashboard(config);
      dashboardSpinner.succeed('Deployment Dashboard generated');

      // Generate Docker Compose
      let dockerCompose = '';
      if (config.project.hasDockerfile) {
        dockerCompose = this.dockerComposeService.generateDockerCompose(config);
      }

      // Write files
      const writingSpinner = ora('Writing files...').start();
      await this.writeFiles(
        jenkinsfile,
        credentialsGuide,
        readme,
        envTemplate,
        terraformConfig,
        dashboard,
        dockerCompose,
        config,
      );
      writingSpinner.succeed('Files written successfully');

      // Display summary
      this.displaySummary(config);
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      throw error;
    }
  }

  private async writeFiles(
    jenkinsfile: string,
    credentialsGuide: string,
    readme: string,
    envTemplate: string,
    terraformConfig: string,
    dashboardContent: string,
    dockerComposeContent: string,
    config: any,
  ): Promise<void> {
    const projectDir = process.cwd();
    const cicdDir = path.join(projectDir, '.cicd');

    // Ensure .cicd directory exists
    await fs.ensureDir(cicdDir);

    // Write Jenkinsfile to root
    const jenkinsfilePath = path.join(projectDir, 'Jenkinsfile');
    await fs.writeFile(jenkinsfilePath, jenkinsfile);

    // Write Docker Compose
    if (dockerComposeContent) {
      await fs.writeFile(
        path.join(projectDir, 'docker-compose.yml'),
        dockerComposeContent,
      );
    }

    // Write credentials guide
    const credentialsPath = path.join(cicdDir, 'CREDENTIALS_SETUP.md');
    await fs.writeFile(credentialsPath, credentialsGuide);

    // Write README
    const readmePath = path.join(cicdDir, 'README.md');
    await fs.writeFile(readmePath, readme);

    // Write .env.template
    const envPath = path.join(projectDir, '.env.template');
    await fs.writeFile(envPath, envTemplate);

    // Write Terraform Config
    const terraformDir = path.join(cicdDir, 'terraform');
    await fs.ensureDir(terraformDir);
    const terraformPath = path.join(terraformDir, 'main.tf');
    await fs.writeFile(terraformPath, terraformConfig);

    // Write Dashboard
    const dashboardPath = path.join(cicdDir, 'dashboard.html');
    await fs.writeFile(dashboardPath, dashboardContent);

    // Write encrypted config
    const configPath = path.join(cicdDir, 'config.encrypted.json');
    const encrypted = this.securityService.encryptCredentials(config);
    await fs.writeFile(configPath, encrypted);

    // Update .gitignore to ignore sensitive files
    await this.updateRootGitignore(projectDir);

    console.log(chalk.green('\n📁 Generated files:'));
    console.log(chalk.gray(`  ├─ Jenkinsfile (${jenkinsfilePath})`));
    if (dockerComposeContent) {
      console.log(chalk.gray(`  ├─ docker-compose.yml`));
    }
    if (envTemplate) {
      console.log(chalk.gray(`  ├─ .env.template (for local development)`));
    }
    console.log(chalk.gray(`  ├─ .cicd/terraform/main.tf`));
    console.log(chalk.gray(`  ├─ .cicd/dashboard.html`));
    console.log(chalk.gray(`  ├─ .cicd/CREDENTIALS_SETUP.md`));
    console.log(chalk.gray(`  ├─ .cicd/README.md`));
    console.log(chalk.gray(`  └─ .cicd/config.encrypted.json`));
  }

  private async updateRootGitignore(rootDir: string): Promise<void> {
    const gitignorePath = path.join(rootDir, '.gitignore');

    try {
      let gitignoreContent = '';

      // Read existing .gitignore if it exists
      if (await fs.pathExists(gitignorePath)) {
        gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      }

      // Add .env entries if not already present
      const entriesToAdd = [
        '# Environment variables',
        '.env',
        '.env.local',
        '.env.*.local',
      ];

      let needsUpdate = false;
      const newEntries: string[] = [];

      for (const entry of entriesToAdd) {
        if (!gitignoreContent.includes(entry)) {
          newEntries.push(entry);
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        const separator = gitignoreContent ? '\n\n' : '';
        gitignoreContent += separator + newEntries.join('\n') + '\n';
        await fs.writeFile(gitignorePath, gitignoreContent);
        console.log(
          chalk.gray('  ├─ Updated .gitignore to exclude .env files'),
        );
      }
    } catch (error) {
      // Ignore errors updating .gitignore
      console.log(
        chalk.yellow('  ⚠️  Could not update .gitignore (non-critical)'),
      );
    }
  }

  private displaySummary(config: any): void {
    console.log(
      chalk.green.bold('\n✅ CICD Pipeline Generated Successfully!\n'),
    );

    console.log(chalk.cyan('📋 Configuration Summary:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.white(`  Project:       ${config.project.projectName}`));
    console.log(chalk.white(`  Type:          ${config.project.projectType}`));
    console.log(chalk.white(`  Language:      ${config.project.language}`));
    console.log(chalk.white(`  Repository:    ${config.project.repository}`));
    console.log(chalk.white(`  Branch:        ${config.project.branch}`));
    console.log(
      chalk.white(`  Cloud:         ${config.cloud.provider.toUpperCase()}`),
    );
    console.log(chalk.white(`  Region:        ${config.cloud.region}`));
    console.log(chalk.white(`  Instance:      ${config.cloud.instanceType}`));
    console.log(
      chalk.white(
        `  Tests:         ${config.project.runTests ? 'Enabled' : 'Disabled'}`,
      ),
    );
    console.log(
      chalk.white(
        `  Auto-scaling:  ${
          config.cloud.deploymentConfig.autoScaling ? 'Enabled' : 'Disabled'
        }`,
      ),
    );

    // NEW: Show external services summary
    if (
      config.project.externalServices &&
      config.project.externalServices.length > 0
    ) {
      console.log(
        chalk.white(
          `  External Services: ${config.project.externalServices.length} configured`,
        ),
      );
      for (const service of config.project.externalServices) {
        console.log(chalk.gray(`    - ${service.name} (${service.service})`));
      }
    }

    console.log(chalk.gray('─'.repeat(60)));

    console.log(chalk.yellow('\n📝 Next Steps:\n'));
    console.log(
      chalk.white('  1. Review the generated Jenkinsfile in your project root'),
    );

    if (
      config.project.externalServices &&
      config.project.externalServices.length > 0
    ) {
      console.log(
        chalk.white('  2. Copy .env.template to .env and fill in your values'),
      );
      console.log(
        chalk.white(
          '  3. Read .cicd/CREDENTIALS_SETUP.md for Jenkins credential setup',
        ),
      );
    } else {
      console.log(
        chalk.white(
          '  2. Read .cicd/CREDENTIALS_SETUP.md for Jenkins credential setup',
        ),
      );
    }

    console.log(chalk.white('  4. Configure Jenkins credentials as specified'));
    console.log(chalk.white('  5. Create a new Jenkins Pipeline job'));
    console.log(chalk.white('  6. Point Jenkins to your repository'));
    console.log(chalk.white('  7. Run the pipeline and monitor deployment'));

    console.log(chalk.yellow('\n⚠️  Important Security Notes:\n'));
    console.log(
      chalk.red(
        '  • NEVER commit .env or .cicd/config.encrypted.json to version control',
      ),
    );
    console.log(
      chalk.red('  • Always use Jenkins credential storage for sensitive data'),
    );
    console.log(chalk.red('  • Review and rotate credentials regularly'));
    console.log(chalk.red('  • Keep your Jenkinsfile in version control'));

    if (
      config.project.externalServices &&
      config.project.externalServices.length > 0
    ) {
      console.log(
        chalk.red('  • .env.template is safe to commit, but NEVER commit .env'),
      );
    }

    console.log(
      chalk.cyan('\n🚀 Your CI/CD pipeline is ready for deployment!\n'),
    );
    console.log(
      chalk.gray(`For detailed documentation, check .cicd/README.md\n`),
    );
  }
}
