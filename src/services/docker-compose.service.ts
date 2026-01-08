import { Injectable } from '@nestjs/common';
import { CICDConfig, ExternalService } from '../interfaces/config.interface';

@Injectable()
export class DockerComposeService {
  generateDockerCompose(config: CICDConfig): string {
    const { project } = config;
    const services: any = {};

    // 1. Add the main application service
    services['app'] = {
      build: '.',
      ports: [
        `${config.cloud.deploymentConfig.port}:${config.cloud.deploymentConfig.port}`,
      ],
      env_file: ['.env'],
      depends_on: project.externalServices
        .filter((s) => s.requiresInfrastructure)
        .map((s) => this.getServiceName(s)),
    };

    // 2. Add external services
    project.externalServices.forEach((service) => {
      if (service.requiresInfrastructure) {
        services[this.getServiceName(service)] = this.getServiceConfig(service);
      }
    });

    const compose = {
      version: '3.8',
      services: services,
    };

    return this.yamlify(compose);
  }

  private getServiceName(service: ExternalService): string {
    return service.name.toLowerCase().replace(/\s+/g, '-');
  }

  private getServiceConfig(service: ExternalService): any {
    switch (service.service.toLowerCase()) {
      case 'postgresql':
        return {
          image: 'postgres:latest',
          environment: {
            POSTGRES_USER: 'user',
            POSTGRES_PASSWORD: 'password',
            POSTGRES_DB: 'app_db',
          },
          ports: ['5432:5432'],
        };
      case 'mongodb':
        return {
          image: 'mongo:latest',
          ports: ['27017:27017'],
        };
      case 'redis':
        return {
          image: 'redis:latest',
          ports: ['6379:6379'],
        };
      case 'mysql':
      case 'mariadb':
        return {
          image:
            service.service.toLowerCase() === 'mysql'
              ? 'mysql:latest'
              : 'mariadb:latest',
          environment: {
            MYSQL_ROOT_PASSWORD: 'password',
            MYSQL_DATABASE: 'app_db',
          },
          ports: ['3306:3306'],
        };
      case 'rabbitmq':
        return {
          image: 'rabbitmq:3-management',
          ports: ['5672:5672', '15672:15672'],
        };
      default:
        return {
          image: 'alpine:latest',
          command: 'sleep infinity',
        };
    }
  }

  private yamlify(obj: any, indent = 0): string {
    const spaces = ' '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value !== null
      ) {
        yaml += `${spaces}${key}:\n${this.yamlify(value, indent + 2)}`;
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        value.forEach((item) => {
          const formattedItem = typeof item === 'string' ? `"${item}"` : item;
          yaml += `${spaces}  - ${formattedItem}\n`;
        });
      } else {
        const formattedValue = typeof value === 'string' ? `"${value}"` : value;
        yaml += `${spaces}${key}: ${formattedValue}\n`;
      }
    }

    return yaml;
  }
}
