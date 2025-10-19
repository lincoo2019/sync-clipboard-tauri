/**
 * 简单的 WebDAV 测试工具
 */

export interface SimpleTestResult {
  success: boolean
  message: string
  details?: any
}

/**
 * 测试 WebDAV 连接的简化版本
 */
export async function testWebDAVConnection(config: {
  host_url: string
  username: string
  password: string
  destination_dir: string
}): Promise<SimpleTestResult> {
  console.log('🔍 开始 WebDAV 连接测试...', config)

  // 1. 基础配置验证
  if (!config.host_url.trim()) {
    return {
      success: false,
      message: '❌ 服务器 URL 不能为空'
    }
  }

  if (!config.username.trim()) {
    return {
      success: false,
      message: '❌ 用户名不能为空'
    }
  }

  if (!config.password.trim()) {
    return {
      success: false,
      message: '❌ 密码不能为空'
    }
  }

  // 2. URL 格式验证
  try {
    new URL(config.host_url)
    console.log('✅ URL 格式验证通过')
  } catch (error) {
    return {
      success: false,
      message: `❌ 服务器 URL 格式无效: ${config.host_url}\n请确保包含 http:// 或 https://`
    }
  }

  // 3. 尝试调用 Tauri 命令
  try {
    console.log('📡 准备调用 Tauri WebDAV 测试命令...')

    // 动态导入 Tauri API - 使用正确的方式导入命令
    const { invoke } = await import('@tauri-apps/api/core')
    console.log('✅ Tauri API 导入成功')

    console.log('🚀 调用 webdav_test_connection 命令...')
    const result = await invoke('webdav_test_connection', { config })
    console.log('📨 Tauri 命令返回结果:', result)

    if (result) {
      return {
        success: true,
        message: '✅ WebDAV 连接测试成功！\n服务器响应正常，可以同步剪贴板数据',
        details: { result }
      }
    } else {
      return {
        success: false,
        message: '❌ WebDAV 连接测试失败\n服务器返回了错误响应\n\n请检查：\n• 服务器 URL 是否正确\n• 用户名和密码是否正确\n• WebDAV 服务是否已启用\n• 网络连接是否正常',
        details: { result }
      }
    }

  } catch (error) {
    console.error('💥 WebDAV 测试异常:', error)

    // 详细的错误分析
    let errorMessage = '❌ WebDAV 连接测试失败'

    if (error instanceof Error) {
      errorMessage += `: ${error.message}`

      // 根据错误类型提供具体建议
      if (error.message.includes('401')) {
        errorMessage += '\n\n🔍 问题分析：身份验证失败\n💡 解决方案：\n• 检查用户名和密码\n• 如启用2FA，请使用应用专用密码\n• 确认账户有WebDAV权限'
      } else if (error.message.includes('404')) {
        errorMessage += '\n\n🔍 问题分析：服务器返回404错误\n💡 解决方案：\n• 检查WebDAV服务器URL\n• 确认WebDAV服务已启用\n• 验证目标目录路径'
      } else if (error.message.includes('timeout')) {
        errorMessage += '\n\n🔍 问题分析：连接超时\n💡 解决方案：\n• 检查网络连接\n• 确认服务器地址正确\n• 服务器可能响应缓慢'
      } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
        errorMessage += '\n\n🔍 问题分析：SSL证书问题\n💡 解决方案：\n• 检查SSL证书有效性\n• 尝试使用http://而非https://\n• 联系管理员解决证书问题'
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage += '\n\n🔍 问题分析：网络连接问题\n💡 解决方案：\n• 检查网络连接\n• 验证服务器地址\n• 确认服务器在线'
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage += '\n\n🔍 问题分析：无法获取响应\n💡 解决方案：\n• 检查网络连接\n• 验证URL格式\n• 可能是CORS或防火墙问题'
      }
    } else {
      errorMessage += `: ${String(error)}`
    }

    return {
      success: false,
      message: errorMessage,
      details: { error }
    }
  }
}

/**
 * 测试网络连接的简化版本（不进行文件操作）
 */
export async function testBasicConnection(url: string): Promise<SimpleTestResult> {
  try {
    console.log('🌐 测试基础网络连接到:', url)

    // 使用 fetch 测试基础连接
    const response = await fetch(url, {
      method: 'HEAD', // 只获取头部，不下载内容
      mode: 'no-cors', // 避免 CORS 问题
      cache: 'no-cache'
    })

    console.log('📡 网络连接测试响应:', response)

    return {
      success: true,
      message: '✅ 网络连接正常\n服务器可以访问',
      details: { status: response.status }
    }

  } catch (error) {
    console.error('💥 网络连接测试失败:', error)

    return {
      success: false,
      message: `❌ 网络连接测试失败: ${error instanceof Error ? error.message : String(error)}\n\n请检查：\n• 服务器地址是否正确\n• 网络连接是否正常\n• 服务器是否在线`,
      details: { error }
    }
  }
}