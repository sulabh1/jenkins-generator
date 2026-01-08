import { Injectable } from '@nestjs/common';
import { NotificationConfig } from '../interfaces/config.interface';

@Injectable()
export class NotificationService {
  generateNotificationScript(config: NotificationConfig): string {
    let script = this.generateEmailNotification(config.email);

    if (config.platforms && config.platforms.length > 0) {
      for (const platform of config.platforms) {
        if (!platform.webhook) continue;

        switch (platform.type) {
          case 'slack':
            script += this.generateSlackNotification(platform.webhook);
            break;
          case 'discord':
            script += this.generateDiscordNotification(platform.webhook);
            break;
          case 'teams':
            script += this.generateTeamsNotification(platform.webhook);
            break;
          case 'telegram':
            script += this.generateTelegramNotification(platform.webhook);
            break;
        }
      }
    }
    return script;
  }

  private generateEmailNotification(email: string): string {
    return `
    def sendEmailNotification(status, stageName='') {
        def subject = "[\${status}] Jenkins Pipeline - \${env.JOB_NAME} #\${env.BUILD_NUMBER}"
        def body = """
        <html>
        <body>
            <h2>Jenkins Pipeline Notification</h2>
            <p><strong>Job:</strong> \${env.JOB_NAME}</p>
            <p><strong>Build Number:</strong> \${env.BUILD_NUMBER}</p>
            <p><strong>Status:</strong> <span style="color: \${status == 'SUCCESS' ? 'green' : 'red'};">\${status}</span></p>
            \${stageName ? "<p><strong>Stage:</strong> \${stageName}</p>" : ""}
            <p><strong>Duration:</strong> \${currentBuild.durationString}</p>
            <p><strong>Build URL:</strong> <a href="\${env.BUILD_URL}">\${env.BUILD_URL}</a></p>
            <p><strong>Console Output:</strong> <a href="\${env.BUILD_URL}console">\${env.BUILD_URL}console</a></p>
            <hr>
            <p><strong>Changes:</strong></p>
            <pre>\${currentBuild.changeSets.collect { it.items.collect { "\${it.author} - \${it.msg}" }.join('\\n') }.join('\\n')}</pre>
        </body>
        </html>
        """

        emailext(
            subject: subject,
            body: body,
            to: '${email}',
            mimeType: 'text/html',
            attachLog: status != 'SUCCESS'
        )
    }
    `;
  }

  private generateSlackNotification(webhook: string): string {
    return `
    def sendSlackNotification(status, stageName = ''){
        def color = status == 'SUCCESS' ? 'good' : 'danger'
        def message = [
            text: "Jenkins Pipeline \${status}",
            attachments:[[
                color: color,
                title: "Jenkins Pipeline \${status}",
                title_link: "\${env.BUILD_URL}",
                fields: [
                    [title: "Status", value: status, short: true],
                    [title: "Branch", value: "\${env.BRANCH_NAME}", short: true],
                    [title: "Duration", value: "\${currentBuild.durationString}", short: true],
                    \${stageName ? "[title: 'Stage', value: '\${stageName}', short: true]," : ""}
                ],
                footer: "Jenkins",
                ts: (System.currentTimeMillis() / 1000).toLong()
            ]]
        ]
        sh """
            curl -X POST '${webhook}' \\
            -H 'Content-Type: application/json' \\
            -d '\${groovy.json.JsonOutput.toJson(message)}'
        """
    }
    `;
  }

  private generateDiscordNotification(webhook: string): string {
    return `
def sendDiscordNotification(status, stageName = '') {
  def color = status == 'SUCCESS' ? 3066993 : 15158332
  def message = [
    embeds: [[
      title: "Jenkins Pipeline \${status}",
      description: "\${env.JOB_NAME} #\${env.BUILD_NUMBER}",
      color: color,
      fields: [
        [name: "Status", value: status, inline: true],
        [name: "Branch", value: "\${env.BRANCH_NAME}", inline: true],
        [name: "Duration", value: "\${currentBuild.durationString}", inline: true],
        \${stageName ? "[name: 'Stage', value: '\${stageName}', inline: true]," : ""}
      ],
      footer: [text: "Jenkins"],
      timestamp: new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'"),
      url: "\${env.BUILD_URL}"
    ]]
  ]
  
  sh """
    curl -X POST '${webhook}' \\
    -H 'Content-Type: application/json' \\
    -d '\${groovy.json.JsonOutput.toJson(message)}'
  """
}
`;
  }

  private generateTeamsNotification(webhook: string): string {
    return `
def sendTeamsNotification(status, stageName = '') {
  def color = status == 'SUCCESS' ? '00FF00' : 'FF0000'
  def message = [
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: color,
    summary: "Jenkins Pipeline \${status}",
    sections: [[
      activityTitle: "Jenkins Pipeline \${status}",
      activitySubtitle: "\${env.JOB_NAME} #\${env.BUILD_NUMBER}",
      facts: [
        [name: "Status", value: status],
        [name: "Branch", value: "\${env.BRANCH_NAME}"],
        [name: "Duration", value: "\${currentBuild.durationString}"],
        \${stageName ? "[name: 'Stage', value: '\${stageName}']," : ""}
      ],
      markdown: true
    ]],
    potentialAction: [[
      "@type": "OpenUri",
      name: "View Build",
      targets: [[
        os: "default",
        uri: "\${env.BUILD_URL}"
      ]]
    ]]
  ]
  
  sh """
    curl -X POST '${webhook}' \\
    -H 'Content-Type: application/json' \\
    -d '\${groovy.json.JsonOutput.toJson(message)}'
  """
}
`;
  }

  private generateTelegramNotification(webhook: string): string {
    const parts = webhook.split('/');
    const botToken = parts[parts.length - 2];
    const chatId = parts[parts.length - 1];

    return `
def sendTelegramNotification(status, stageName = '') {
  def emoji = status == 'SUCCESS' ? '✅' : '❌'
  def message = """
\${emoji} *Jenkins Pipeline \${status}*

*Job:* \${env.JOB_NAME}
*Build:* #\${env.BUILD_NUMBER}
*Status:* \${status}
*Branch:* \${env.BRANCH_NAME}
\${stageName ? "*Stage:* \${stageName}" : ""}
*Duration:* \${currentBuild.durationString}

[View Build](\${env.BUILD_URL})
  """
  
  sh """
    curl -X POST 'https://api.telegram.org/bot${botToken}/sendMessage' \\
    -H 'Content-Type: application/json' \\
    -d '{
      "chat_id": "${chatId}",
      "text": "\${message.replaceAll('"', '\\\\"')}",
      "parse_mode": "Markdown",
      "disable_web_page_preview": true
    }'
  """
}
`;
  }

  generatePostStageNotifications(): string {
    return `
    post {
      success {
        script {
            sendEmailNotification('SUCCESS')
            try {sendSlackNotification('SUCCESS')} catch(e){}
            try {sendDiscordNotification('SUCCESS')} catch(e){}
            try {sendTeamsNotification('SUCCESS')} catch(e){}
            try {sendTelegramNotification('SUCCESS')} catch(e){}
        }
      }
      failure {
        script {
            sendEmailNotification('FAILURE')
            try {sendSlackNotification('FAILURE')} catch(e){}
            try {sendDiscordNotification('FAILURE')} catch(e){}
            try {sendTeamsNotification('FAILURE')} catch(e){}
            try {sendTelegramNotification('FAILURE')} catch(e){}
        }
      }
      unstable {
        script {
            sendEmailNotification('UNSTABLE')
            try {sendSlackNotification('UNSTABLE')} catch(e){}
            try {sendDiscordNotification('UNSTABLE')} catch(e){}
            try {sendTeamsNotification('UNSTABLE')} catch(e){}
            try {sendTelegramNotification('UNSTABLE')} catch(e){}
        }
      }
    }`;
  }
}
