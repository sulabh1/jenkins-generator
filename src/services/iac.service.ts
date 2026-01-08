import { Injectable } from '@nestjs/common';
import { CloudConfig } from '../interfaces/config.interface';

@Injectable()
export class IaCService {
  generateTerraformConfig(
    config: CloudConfig,
    dockerImageName: string,
  ): string {
    switch (config.provider) {
      case 'aws':
        return this.generateAWSTerraform(config, dockerImageName);
      case 'azure':
        return this.generateAzureTerraform(config, dockerImageName);
      case 'gcp':
        return this.generateGCPTerraform(config, dockerImageName);
      case 'digitalocean':
        return this.generateDOTerraform(config, dockerImageName);
      default:
        return '';
    }
  }

  private generateAWSTerraform(
    config: CloudConfig,
    dockerImageName: string,
  ): string {
    return `
provider "aws" {
  region = "${config.region}"
}

resource "aws_ecs_cluster" "main" {
  name = "${dockerImageName}-cluster"
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${dockerImageName}-task-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
`;
  }

  private generateAzureTerraform(
    config: CloudConfig,
    dockerImageName: string,
  ): string {
    return `
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "\${var.resource_group_name}"
  location = "${config.region}"
}

resource "azurerm_container_group" "main" {
  name                = "${dockerImageName}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  ip_address_type     = "Public"
  dns_name_label      = "${dockerImageName}"
  os_type             = "Linux"

  container {
    name   = "${dockerImageName}"
    image  = "\${var.docker_image}"
    cpu    = "1"
    memory = "1.5"

    ports {
      port     = ${config.deploymentConfig.port}
      protocol = "TCP"
    }
  }
}
`;
  }

  private generateGCPTerraform(
    config: CloudConfig,
    dockerImageName: string,
  ): string {
    return `
provider "google" {
  project = "\${var.gcp_project_id}"
  region  = "${config.region}"
}

resource "google_cloud_run_service" "main" {
  name     = "${dockerImageName}"
  location = "${config.region}"

  template {
    spec {
      containers {
        image = "\${var.docker_image}"
        ports {
          container_port = ${config.deploymentConfig.port}
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloud_run_service_iam_member" "public_access" {
  service  = google_cloud_run_service.main.name
  location = google_cloud_run_service.main.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
`;
  }

  private generateDOTerraform(
    config: CloudConfig,
    dockerImageName: string,
  ): string {
    return `
provider "digitalocean" {
  token = "\${var.do_token}"
}

resource "digitalocean_app" "main" {
  spec {
    name   = "${dockerImageName}"
    region = "${config.region}"

    service {
      name               = "${dockerImageName}"
      instance_count     = ${config.deploymentConfig.minInstances || 1}
      instance_size_slug = "basic-xxs"

      image {
        registry_type = "DOCKER_HUB"
        repository    = "\${var.docker_image}"
      }

      http_port = ${config.deploymentConfig.port}

      health_check {
        http_path = "${config.deploymentConfig.healthCheckPath}"
      }
    }
  }
}
`;
  }
}
