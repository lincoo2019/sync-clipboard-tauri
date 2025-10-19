<template>
  <div class="bg-white rounded-lg shadow p-4">
    <h2 class="text-lg font-semibold mb-4">WebDAV 配置</h2>
    <p class="text-gray-600 text-sm mb-4">
      配置 WebDAV 服务器以同步剪贴板数据
    </p>

    <div class="space-y-4">
      <!-- 服务器 URL -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          WebDAV 服务器 URL
        </label>
        <input
          v-model="localConfig.host_url"
          @input="onConfigChange"
          type="url"
          placeholder="https://your-webdav-server.com/dav/"
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="text-xs text-gray-500 mt-1">
          完整的 WebDAV 服务器地址，包含协议和路径
        </p>
      </div>

      <!-- 用户名 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          用户名
        </label>
        <input
          v-model="localConfig.username"
          @input="onConfigChange"
          type="text"
          placeholder="your-username"
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- 密码 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          密码
        </label>
        <div class="relative">
          <input
            v-model="localConfig.password"
            @input="onConfigChange"
            :type="showPassword ? 'text' : 'password'"
            placeholder="your-password"
            class="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            @click="showPassword = !showPassword"
            type="button"
            class="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <span class="text-gray-400 hover:text-gray-600">
              {{ showPassword ? '👁️' : '👁️‍🗨️' }}
            </span>
          </button>
        </div>
      </div>

      <!-- 目标目录 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          目标目录
        </label>
        <input
          v-model="localConfig.destination_dir"
          @input="onConfigChange"
          type="text"
          placeholder="/clipboard-sync"
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="text-xs text-gray-500 mt-1">
          在 WebDAV 服务器上存储剪贴板数据的目录路径
        </p>
      </div>

      <!-- 操作按钮 -->
      <div class="flex space-x-3 pt-4">
        <button
          @click="testConnection"
          :disabled="isTesting || !isConfigValid"
          class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          {{ isTesting ? '测试中...' : '测试连接' }}
        </button>
        <button
          @click="saveConfig"
          :disabled="!isConfigValid || !hasChanges"
          class="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          保存配置
        </button>
      </div>

      <!-- 状态消息 -->
      <div
        v-if="statusMessage"
        :class="[
          'p-3 rounded-md text-sm whitespace-pre-line',
          statusMessage.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        ]"
      >
        {{ statusMessage.text }}
      </div>

      <!-- 使用提示 -->
      <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 class="text-sm font-semibold text-blue-800 mb-2">📋 使用提示</h3>
        <div class="text-xs text-blue-700 space-y-2">
          <div>
            <strong>常见 WebDAV 服务器配置：</strong>
            <ul class="ml-4 mt-1 space-y-1">
              <li>• <strong>Nextcloud/ownCloud:</strong> https://your-domain.com/remote.php/dav/files/username/</li>
              <li>• <strong>坚果云:</strong> https://dav.jianguoyun.com/dav/</li>
              <li>• <strong>通用服务器:</strong> https://your-domain.com/webdav/ 或 /dav/</li>
            </ul>
          </div>
          <div>
            <strong>连接问题排查：</strong>
            <ul class="ml-4 mt-1 space-y-1">
              <li>• 确保 URL 以 / 结尾</li>
              <li>• 检查用户名和密码是否正确</li>
              <li>• 如果启用了两步验证，请使用应用专用密码</li>
              <li>• 尝试使用 http:// 而不是 https:// 测试</li>
              <li>• 确认 WebDAV 服务已启用</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { WebDAVConfig, TestResult } from '@/services/clipboard-service'
import { DEFAULT_WEBDAV_CONFIG } from '@/services/clipboard-service'

interface Props {
  modelValue?: WebDAVConfig
}

interface Emits {
  (e: 'update:modelValue', value: WebDAVConfig): void
  (e: 'save', config: WebDAVConfig): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({ ...DEFAULT_WEBDAV_CONFIG })
})

const emit = defineEmits<Emits>()

const localConfig = ref<WebDAVConfig>({ ...props.modelValue })
const showPassword = ref(false)
const isTesting = ref(false)
const statusMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const isConfigValid = computed(() => {
  return localConfig.value.host_url.trim() !== '' &&
         localConfig.value.username.trim() !== '' &&
         localConfig.value.password.trim() !== '' &&
         localConfig.value.destination_dir.trim() !== ''
})

const hasChanges = computed(() => {
  return JSON.stringify(localConfig.value) !== JSON.stringify(props.modelValue)
})

const onConfigChange = () => {
  emit('update:modelValue', { ...localConfig.value })
}

const testConnection = async () => {
  if (!isConfigValid.value) return

  isTesting.value = true
  statusMessage.value = null

  try {
    console.log('开始测试 WebDAV 连接...', localConfig.value)

    // 验证配置完整性
    if (!localConfig.value.host_url.trim()) {
      statusMessage.value = {
        type: 'error',
        text: '❌ 服务器 URL 不能为空'
      }
      return
    }

    if (!localConfig.value.username.trim()) {
      statusMessage.value = {
        type: 'error',
        text: '❌ 用户名不能为空'
      }
      return
    }

    if (!localConfig.value.password.trim()) {
      statusMessage.value = {
        type: 'error',
        text: '❌ 密码不能为空'
      }
      return
    }

    // 验证 URL 格式
    try {
      new URL(localConfig.value.host_url)
    } catch {
      statusMessage.value = {
        type: 'error',
        text: `❌ 服务器 URL 格式无效: ${localConfig.value.host_url}`
      }
      return
    }

    console.log('配置验证通过，开始调用 Tauri 命令...')

    const { testWebDAVConnection } = await import('@/utils/webdav-test')
    const result = await testWebDAVConnection(localConfig.value)

    console.log('WebDAV 测试结果:', result)

    statusMessage.value = {
      type: result.success ? 'success' : 'error',
      text: result.message
    }
  } catch (error) {
    console.error('WebDAV 连接测试异常:', error)

    // 提供更详细的错误信息
    let errorMessage = '❌ WebDAV 连接测试失败'

    if (error instanceof Error) {
      errorMessage += `: ${error.message}`

      // 根据错误类型提供具体建议
      if (error.message.includes('timeout')) {
        errorMessage += '\n💡 建议: 检查网络连接，或服务器是否响应缓慢'
      } else if (error.message.includes('401')) {
        errorMessage += '\n💡 建议: 检查用户名和密码是否正确'
      } else if (error.message.includes('404')) {
        errorMessage += '\n💡 建议: 检查服务器 URL 是否正确，WebDAV 服务是否启用'
      } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
        errorMessage += '\n💡 建议: 检查 SSL 证书，或尝试使用 http:// 而不是 https://'
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage += '\n💡 建议: 检查网络连接和服务器地址'
      } else if (error.message.includes('Not found')) {
        errorMessage += '\n💡 建议: 检查目标目录路径是否正确'
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage += '\n💡 建议: 检查网络连接和服务器地址，可能是 CORS 或网络问题'
      }
    } else {
      errorMessage += `: ${String(error)}`
    }

    statusMessage.value = {
      type: 'error',
      text: errorMessage
    }
  } finally {
    isTesting.value = false
  }
}

const saveConfig = () => {
  if (!isConfigValid.value) return

  emit('save', { ...localConfig.value })
  statusMessage.value = {
    type: 'success',
    text: 'WebDAV 配置已保存'
  }

  // 3秒后清除成功消息
  setTimeout(() => {
    if (statusMessage.value?.type === 'success') {
      statusMessage.value = null
    }
  }, 3000)
}

// 监听外部配置变化
watch(() => props.modelValue, (newValue) => {
  if (JSON.stringify(newValue) !== JSON.stringify(localConfig.value)) {
    localConfig.value = { ...newValue }
  }
}, { deep: true })
</script>

<style scoped>
/* 自定义样式 */
</style>