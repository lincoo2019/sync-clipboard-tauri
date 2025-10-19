import { BaseDirectory, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml'
import { computed, type Ref, ref } from 'vue'

/**
 * 存储类型枚举
 */
export enum StorageType {
  HTTP = 'http',
  WEBDAV = 'webdav'
}

/**
 * 服务器配置接口
 */
export interface ServerConfig {
  url: string
  username: string
  password: string
  storageType: StorageType
  webdavConfig?: WebDAVConfig
}

/**
 * WebDAV 配置接口
 */
export interface WebDAVConfig {
  host_url: string
  username: string
  password: string
  destination_dir: string
}

/**
 * 测试结果接口
 */
export interface TestResult {
  success: boolean
  message: string
}

/**
 * 配置文件路径常量
 */
export const CONFIG_FILE = 'clipboard-sync-config.toml'

/**
 * 默认服务器配置
 */
export const DEFAULT_CONFIG: ServerConfig = {
  url: '',
  username: '',
  password: '',
  storageType: StorageType.HTTP,
  webdavConfig: {
    host_url: '',
    username: '',
    password: '',
    destination_dir: '/clipboard-sync'
  }
}

/**
 * 默认 WebDAV 配置
 */
export const DEFAULT_WEBDAV_CONFIG: WebDAVConfig = {
  host_url: '',
  username: '',
  password: '',
  destination_dir: '/clipboard-sync'
}

/**
 * 将字符串转换为 Unicode 编码表示形式
 * @param str 输入的字符串
 * @returns 返回 \uXXXX 格式的 Unicode 字符串
 * @example stringToUnicode("你好") // 输出 "\u4f60\u597d"
 */
export function stringToUnicode(str: string): string {
  let unicodeString = ''
  for (let i = 0; i < str.length; i++) {
    // 获取字符的 Unicode 码点 (十进制)
    const code = str.charCodeAt(i)
    // 转换为十六进制，并补全为4位
    const hexCode = code.toString(16).padStart(4, '0')
    // 拼接成 \uXXXX 格式
    unicodeString += `\\u${hexCode}`
  }
  return unicodeString
}

/**
 * 将 Unicode 编码字符串转换回原始字符串
 * @param unicodeStr 包含 \uXXXX 格式的 Unicode 字符串
 * @returns 返回解码后的原始字符串
 * @example unicodeToString("\u4f60\u597d") // => "你好"
 */
export function unicodeToString(unicodeStr: string): string {
  // 使用正则表达式匹配所有的 \uXXXX 格式
  return unicodeStr.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) => {
    // 将匹配到的十六进制码点转换为字符
    return String.fromCharCode(Number.parseInt(hex, 16))
  })
}

/**
 * 从 TOML 配置文件加载服务器配置
 * @param serverConfig 响应式配置对象
 * @returns Promise<void>
 */
export async function loadConfig(serverConfig: Ref<ServerConfig>): Promise<void> {
  try {
    const configContent = await readTextFile(CONFIG_FILE, {
      baseDir: BaseDirectory.AppData,
    })
    const parsedConfig = parseToml(configContent) as Partial<ServerConfig>
    serverConfig.value = { ...serverConfig.value, ...parsedConfig }
    console.log('Configuration loaded successfully')
  } catch (_error) {
    console.error('No saved configuration found, using defaults:', _error)
  }
}

/**
 * 保存服务器配置到 TOML 文件
 * @param serverConfig 响应式配置对象
 * @returns Promise<void>
 */
export async function saveConfig(serverConfig: Ref<ServerConfig>): Promise<void> {
  try {
    const tomlContent = stringifyToml(serverConfig.value)
    await writeTextFile(CONFIG_FILE, tomlContent, {
      baseDir: BaseDirectory.AppData,
    })
    console.log('Configuration saved successfully')
  } catch (error) {
    console.error('Failed to save configuration:', error)
    throw error
  }
}

/**
 * 创建完整文件 URL 的计算属性
 * @param serverConfig 响应式配置对象
 * @returns 计算属性，返回完整的文件 URL
 */
export function useFullFileUrl(serverConfig: Ref<ServerConfig>) {
  return computed(() => {
    const baseUrl = serverConfig.value.url.replace(/\/+$/, '') // 移除末尾的斜杠
    return `${baseUrl}/SyncClipboard.json`
  })
}

/**
 * 创建文件下载 URL 的函数
 * @param serverConfig 响应式配置对象
 * @param filename 文件名
 * @returns 完整的文件下载 URL
 */
export function createFileDownloadUrl(serverConfig: Ref<ServerConfig>, filename: string): string {
  const baseUrl = serverConfig.value.url.replace(/\/+$/, '') // 移除末尾的斜杠
  return `${baseUrl}/file/${filename}`
}

/**
 * WebDAV 客户端类
 */
export class WebDAVClient {
  private config: WebDAVConfig

  constructor(config: WebDAVConfig) {
    this.config = config
  }

  /**
   * 测试 WebDAV 连接
   */
  async testConnection(): Promise<TestResult> {
    try {
      console.log('WebDAV Client: 开始测试连接到', this.config.host_url)

      const { invoke } = await import('@tauri-apps/api/core')
      const success = await invoke('webdav_test_connection', { config: this.config })

      console.log('WebDAV Client: 连接测试结果', success)

      if (success) {
        return {
          success: true,
          message: '✅ WebDAV 连接测试成功！服务器响应正常，可以同步剪贴板数据'
        }
      } else {
        return {
          success: false,
          message: '❌ WebDAV 连接测试失败：服务器返回错误响应\n请检查以下项目：\n• 服务器 URL 是否正确\n• 用户名和密码是否正确\n• WebDAV 服务是否已启用\n• 网络连接是否正常'
        }
      }
    } catch (error) {
      console.error('WebDAV Client: 连接测试异常', error)

      let errorMessage = '❌ WebDAV 连接测试失败'

      if (error instanceof Error) {
        errorMessage += `: ${error.message}`

        // 根据错误类型提供具体建议
        if (error.message.includes('Not found')) {
          errorMessage += '\n🔍 问题分析：服务器返回 404 错误\n💡 解决方案：\n• 检查 WebDAV 服务器 URL 是否正确\n• 确认 WebDAV 服务已启用\n• 验证目标目录路径是否有效'
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMessage += '\n🔍 问题分析：身份验证失败\n💡 解决方案：\n• 检查用户名和密码是否正确\n• 确认账户有 WebDAV 访问权限\n• 如果启用了 2FA，请使用应用专用密码'
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorMessage += '\n🔍 问题分析：访问被禁止\n💡 解决方案：\n• 检查用户权限设置\n• 确认 WebDAV 功能已启用\n• 联系管理员检查访问权限'
        } else if (error.message.includes('timeout')) {
          errorMessage += '\n🔍 问题分析：连接超时\n💡 解决方案：\n• 检查网络连接\n• 确认服务器地址是否正确\n• 服务器可能响应缓慢，请稍后重试'
        } else if (error.message.includes('SSL') || error.message.includes('certificate') || error.message.includes('handshake')) {
          errorMessage += '\n🔍 问题分析：SSL/TLS 证书问题\n💡 解决方案：\n• 检查服务器证书是否有效\n• 尝试使用 http:// 而不是 https://\n• 联系管理员解决证书问题'
        } else if (error.message.includes('network') || error.message.includes('connection') || error.message.includes('ENOTFOUND')) {
          errorMessage += '\n🔍 问题分析：网络连接问题\n💡 解决方案：\n• 检查网络连接\n• 验证服务器地址是否正确\n• 确认服务器是否在线'
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage += '\n🔍 问题分析：无法获取响应\n💡 解决方案：\n• 检查网络连接\n• 验证服务器 URL 格式\n• 可能是 CORS 或防火墙问题'
        }
      } else {
        errorMessage += `: ${String(error)}`
      }

      return {
        success: false,
        message: errorMessage
      }
    }
  }

  /**
   * 上传剪贴板数据到 WebDAV
   */
  async uploadClipboardData(data: Uint8Array): Promise<TestResult> {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('webdav_upload_clipboard', {
        config: this.config,
        data: Array.from(data)
      })
      return {
        success: true,
        message: '剪贴板数据已上传到 WebDAV'
      }
    } catch (error) {
      return {
        success: false,
        message: `上传到 WebDAV 失败: ${error}`
      }
    }
  }

  /**
   * 从 WebDAV 下载剪贴板数据
   */
  async downloadClipboardData(): Promise<{ success: boolean; data?: Uint8Array; message: string }> {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke('webdav_download_clipboard', { config: this.config })

      if (result) {
        return {
          success: true,
          data: new Uint8Array(result as number[]),
          message: '从 WebDAV 下载剪贴板数据成功'
        }
      } else {
        return {
          success: false,
          message: 'WebDAV 上没有找到剪贴板数据文件'
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `从 WebDAV 下载失败: ${error}`
      }
    }
  }

  /**
   * 更新 WebDAV 配置
   */
  updateConfig(config: Partial<WebDAVConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): WebDAVConfig {
    return { ...this.config }
  }
}

/**
 * 创建 WebDAV 客户端实例
 * @param config WebDAV 配置
 * @returns WebDAV 客户端实例
 */
export function createWebDAVClient(config: WebDAVConfig): WebDAVClient {
  return new WebDAVClient(config)
}

/**
 * 剪贴板服务 Composable
 * 提供完整的配置管理和 URL 计算功能
 * @param initialConfig 初始配置（可选）
 * @returns 包含配置管理功能的对象
 */
export function useClipboardService(initialConfig?: Partial<ServerConfig>) {
  // 创建响应式配置对象
  const serverConfig = ref<ServerConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  })

  // 创建完整文件 URL 的计算属性
  const fullFileUrl = useFullFileUrl(serverConfig)

  // 创建 WebDAV 客户端实例
  const webdavClient = computed(() => {
    if (serverConfig.value.webdavConfig) {
      return createWebDAVClient(serverConfig.value.webdavConfig)
    }
    return null
  })

  // 加载配置的包装函数
  const loadServerConfig = async () => {
    await loadConfig(serverConfig)
  }

  // 保存配置的包装函数
  const saveServerConfig = async () => {
    await saveConfig(serverConfig)
  }

  // 切换存储类型
  const switchStorageType = async (type: StorageType) => {
    serverConfig.value.storageType = type
    await saveServerConfig()
  }

  // 更新 WebDAV 配置
  const updateWebDAVConfig = async (config: Partial<WebDAVConfig>) => {
    if (serverConfig.value.webdavConfig) {
      serverConfig.value.webdavConfig = { ...serverConfig.value.webdavConfig, ...config }
      await saveServerConfig()
    }
  }

  // 测试当前存储配置
  const testCurrentStorage = async (): Promise<TestResult> => {
    if (serverConfig.value.storageType === StorageType.WEBDAV && webdavClient.value) {
      return await webdavClient.value.testConnection()
    }

    // 这里可以添加 HTTP 测试逻辑
    return {
      success: false,
      message: 'HTTP 存储测试暂未实现'
    }
  }

  return {
    serverConfig,
    fullFileUrl,
    webdavClient,
    storageType: computed(() => serverConfig.value.storageType),
    loadConfig: loadServerConfig,
    saveConfig: saveServerConfig,
    switchStorageType,
    updateWebDAVConfig,
    testCurrentStorage,
    stringToUnicode,
    unicodeToString,
    createFileDownloadUrl: (filename: string) => createFileDownloadUrl(serverConfig, filename),
    StorageType,
  }
}
