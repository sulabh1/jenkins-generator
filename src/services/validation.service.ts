import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class ValidationService {
  async validateDockerfile(dockerfilePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(process.cwd(), dockerfilePath);
      const exists = await fs.pathExists(fullPath);
      if (!exists) {
        throw new Error(`Dockerfile not found at:${dockerfilePath}`);
      }
      const content = await fs.readFile(fullPath, 'utf-8');

      if (!content.includes('FROM')) {
        throw new Error('Invalid Dockerfile: missing FROM instruction');
      }
      return true;
    } catch (error) {
      throw new Error(`Dockerfile validation failed:${error.message}`);
    }
  }

  validateProjectStructure(projectType: string, language: string): boolean {
    const requiredFiles = {
      javascript: ['package.json'],
      typescript: ['package.json', 'tsconfig.json'],
    };

    const files = requiredFiles[language] || [];

    for (const file of files) {
      const filePath = path.resolve(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required file not found:${file}`);
      }
    }
    return true;
  }

  validateGitRepository(repoUrl: string): boolean {
    const gitUrlPattern =
      /^(https?:\/\/|git@)?([\w\.-]+)([:\/])([\w\.-]+)\/([\w\.-]+)(\.git)?$/;
    const githubPattern = /^https?:\/\/github\.com\/[\w-]+\/[\w-]+(\.git)?$/;
    const gitlabPattern = /^https?:\/\/gitlab\.com\/[\w-]+\/[\w-]+(\.git)?$/;
    const bitbucketPattern =
      /^https?:\/\/bitbucket\.org\/[\w-]+\/[\w-]+(\.git)?$/;

    return (
      gitUrlPattern.test(repoUrl) ||
      githubPattern.test(repoUrl) ||
      gitlabPattern.test(repoUrl) ||
      bitbucketPattern.test(repoUrl)
    );
  }

  validatePort(port: number): boolean {
    return port >= 1 && port <= 65535;
  }

  validateInstanceType(provider: string, instanceType: string): boolean {
    const validTypes = {
      aws: [
        't2.micro',
        't2.small',
        't2.medium',
        't3.micro',
        't3.small',
        't3.medium',
        'm5.large',
        'm5.xlarge',
      ],
      azure: [
        'Standard_B1s',
        'Standard_B2s',
        'Standard_D2s_v3',
        'Standard_D4s_v3',
      ],
      gcp: [
        'e2-micro',
        'e2-small',
        'e2-medium',
        'n1-standard-1',
        'n1-standard-2',
      ],
      digitalocean: [
        's-1vcpu-1gb',
        's-2vcpu-2gb',
        's-2vcpu-4gb',
        's-4vcpu-8gb',
      ],
    };

    return validTypes[provider]?.includes(instanceType) || false;
  }

  async readPackageJson(): Promise<any> {
    try {
      const packagePath = path.resolve(process.cwd(), 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read package.json:${error.message}`);
    }
  }
}
