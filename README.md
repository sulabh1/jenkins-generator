# Jenkins Generator 🚀

> **Automated Jenkins CI/CD pipeline generator for multi-cloud deployments**

[![npm version](https://badge.fury.io/js/jenkins-generator.svg)](https://badge.fury.io/js/jenkins-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

Never worry about CI/CD configuration again! This tool automatically generates production-ready Jenkins pipelines for AWS, Azure, GCP, and DigitalOcean with just a few questions.

## ✨ Features

### 🌍 Multi-Cloud Support

- **AWS** - ECS Fargate deployments with auto-scaling
- **Azure** - Container Instances with resource groups
- **GCP** - Cloud Run serverless containers
- **DigitalOcean** - App Platform deployments

### 🔒 Security First

- **AES-256 encryption** for credential storage
- **Masked sensitive data** in logs and output
- **Secure Jenkins credential references**
- **No hardcoded secrets** in generated files
- **Credential rotation reminders**

### 📧 Multi-Channel Notifications

- **Email** - HTML formatted with build details
- **Slack** - Rich attachments with color coding
- **Discord** - Embedded messages with status
- **Microsoft Teams** - Adaptive cards
- **Telegram** - Markdown formatted messages

### 🐳 Docker-Based Deployments

- **Automated image building** from your Dockerfile
- **Registry push** to Docker Hub or private registry
- **Container orchestration** on cloud platforms
- **Health check verification**
- **Automatic cleanup** of old images

### 🧪 Testing Integration

- **Optional test execution** before deployment
- **Configurable test commands**
- **Test result publishing** in Jenkins
- **Retry logic** for flaky tests

### 📊 Advanced Features

- **Auto-scaling configuration**
- **Health check endpoints**
- **Deployment tier management** (dev/staging/production)
- **Build retry logic**
- **Comprehensive logging**
- **Post-deployment verification**

## 🎯 Why Use This?

**Before:**

```
❌ Manually write Jenkinsfile (hours of work)
❌ Configure cloud deployment scripts
❌ Set up notifications for each platform
❌ Handle credentials securely
❌ Document the entire process
❌ Maintain and update pipelines
```

**After:**

```
✅ Run one command: jenkins-generator
✅ Answer a few questions
✅ Get production-ready pipeline
✅ Complete documentation included
✅ Security best practices built-in
✅ Multi-cloud support out of the box
```

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g jenkins-generator
```

### Local Installation

```bash
npm install --save-dev jenkins-generator
```

### Requirements

- **Node.js** 16.0.0 or higher
- **npm** 7.0.0 or higher
- **Git** repository
- **Dockerfile** in your project (or we'll guide you)
- **Jenkins** 2.0+ with required plugins

## 🚀 Quick Start

### 1. Navigate to Your Project

```bash
cd your-awesome-project
```

### 2. Run the Generator

```bash
jenkins-generator
```

### 3. Answer Questions

The CLI will ask you about:

- Project details (name, type, language)
- Git repository and branch
- Docker configuration
- Testing preferences
- Cloud provider selection
- Deployment settings
- Notification channels
- Jenkins configuration

### 4. Review Generated Files

```
your-project/
├── Jenkinsfile                    # 🎯 Main pipeline
└── .cicd/
    ├── README.md                  # 📖 Project documentation
    ├── CREDENTIALS_SETUP.md       # 🔐 Credential guide
    ├── config.encrypted.json      # 🔒 Encrypted backup
    └── .gitignore                 # 🚫 Protect secrets
```

### 5. Configure Jenkins

Follow the instructions in `.cicd/CREDENTIALS_SETUP.md` to:

- Add credentials to Jenkins
- Create pipeline job
- Connect to your repository

### 6. Deploy!

Push your code and watch Jenkins automatically:

- ✅ Checkout code
- ✅ Install dependencies
- ✅ Run tests
- ✅ Build application
- ✅ Create Docker image
- ✅ Push to registry
- ✅ Deploy to cloud
- ✅ Verify health
- ✅ Send notifications

## 📚 Usage Examples

### Example 1: Node.js API on AWS

```bash
$ jenkins-generator

🚀 Jenkins Generator

? Enter your project name: my-api
? Select project type: backend
? Select programming language: typescript
? Enter Git repository URL: https://github.com/user/my-api.git
? Enter branch name to deploy: master
? Does your project have a Dockerfile? Yes
? Should tests run before deployment? Yes
? Select cloud provider: aws
? Select AWS region: us-east-1
? Select instance type: t2.small
? Enable auto-scaling? Yes

✅ Jenkins pipeline generated successfully!
```

### Example 2: React App on GCP

```bash
$ jenkins-generator

? Enter your project name: my-react-app
? Select project type: frontend
? Select programming language: javascript
? Select cloud provider: gcp
? Select GCP region: us-central1

✅ Jenkins pipeline generated successfully!
```

## 🏗️ What Gets Generated

### Jenkinsfile

Complete Jenkins pipeline with:

- Git checkout
- Dependency installation
- Test execution (optional)
- Application build
- Docker image creation
- Registry push
- Cloud deployment
- Health checks
- Notifications

### Documentation

- **README.md** - Project-specific pipeline documentation
- **CREDENTIALS_SETUP.md** - Step-by-step Jenkins credential setup
- **config.encrypted.json** - Encrypted configuration backup

## 🔧 Supported Cloud Providers

| Provider         | Service             | Features                                      |
| ---------------- | ------------------- | --------------------------------------------- |
| **AWS**          | ECS Fargate         | Auto-scaling, Health checks, CloudWatch logs  |
| **Azure**        | Container Instances | Resource groups, Managed identities           |
| **GCP**          | Cloud Run           | Serverless, Auto-scaling, Built-in monitoring |
| **DigitalOcean** | App Platform        | Simple deployment, Automatic SSL              |

## 🔐 Security Features

- **AES-256 Encryption** for credential storage
- **Masked credentials** in all output and logs
- **Jenkins credential storage** integration
- **No plain-text secrets** in generated files
- **Security best practices** documentation
- **Credential rotation** reminders

## 📖 Documentation

- [Setup Guide](./SETUP_GUIDE.md) - Complete installation and setup
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Pre/post deployment steps
- [Troubleshooting](#troubleshooting) - Common issues and solutions

## 🛠️ Requirements

### Jenkins Plugins

Required plugins (automatically documented in generated files):

- Docker Pipeline
- Git Plugin
- Email Extension Plugin
- Pipeline Plugin
- Credentials Binding Plugin
- Blue Ocean (optional)

### Cloud Provider Credentials

You'll need credentials for your chosen cloud provider:

**AWS:**

- Access Key ID
- Secret Access Key

**Azure:**

- Subscription ID
- Client ID
- Client Secret
- Tenant ID

**GCP:**

- Project ID
- Service Account Key File

**DigitalOcean:**

- API Token

## 🐛 Troubleshooting

### Issue: "Command not found"

```bash
# Reinstall globally
npm install -g jenkins-generator

# Or check npm global bin path
npm config get prefix
```

### Issue: "Dockerfile not found"

- Ensure Dockerfile exists at specified path
- Check path is relative to project root
- Verify file name is exactly `Dockerfile` (case-sensitive)

### Issue: "Deployment failed"

- Verify cloud provider credentials in Jenkins
- Check instance type availability in selected region
- Review deployment logs in cloud console
- Ensure sufficient permissions/quotas

### More Help

For more troubleshooting, check the generated `.cicd/README.md` in your project.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- Powered by [TypeScript](https://www.typescriptlang.org/)
- CLI powered by [Inquirer](https://github.com/SBoudrias/Inquirer.js)
- Styled with [Chalk](https://github.com/chalk/chalk)

## 📞 Support

- 📧 **Email:** sulabhadhikari90@gmail.com
- 🐛 **Issues:** [GitHub Issues](https://github.com/sulabh1/cicd-automator/issues)
- 📚 **Docs:** Full documentation in generated `.cicd/` folder

## ⭐ Show Your Support

If this tool helped you, please:

- ⭐ Star the repository
- 🐦 Tweet about it
- 📝 Write a blog post
- 💬 Tell your friends

---

**Made with ❤️ by developers, for developers**

_Stop configuring CI/CD manually. Start deploying automatically!_

```bash
npm install -g jenkins-generator
cd your-project
jenkins-generator
# That's it! 🎉
```
