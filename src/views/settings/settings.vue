<template>
  <div class="container mx-auto p-6 pb-20">
    <h1 class="text-2xl font-bold mb-6">设置</h1>

    <div class="space-y-6">
      <!-- 存储类型选择 -->
      <div class="bg-white rounded-lg shadow p-4">
        <h2 class="text-lg font-semibold mb-4">存储方式</h2>
        <p class="text-gray-600 text-sm mb-4">
          选择剪贴板数据的存储方式
        </p>

        <div class="grid grid-cols-2 gap-4">
          <button
            @click="handleSwitchStorageType(StorageType.HTTP)"
            :class="[
              'p-4 rounded-lg border-2 transition-all',
              serverConfig.storageType === StorageType.HTTP
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            ]"
          >
            <div class="text-lg font-semibold mb-2">🌐 HTTP 服务器</div>
            <div class="text-sm text-gray-600">
              通过自定义 HTTP 服务器同步数据
            </div>
          </button>

          <button
            @click="handleSwitchStorageType(StorageType.WEBDAV)"
            :class="[
              'p-4 rounded-lg border-2 transition-all',
              serverConfig.storageType === StorageType.WEBDAV
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            ]"
          >
            <div class="text-lg font-semibold mb-2">📁 WebDAV 服务器</div>
            <div class="text-sm text-gray-600">
              通过 WebDAV 协议同步数据
            </div>
          </button>
        </div>
      </div>

      <!-- WebDAV 配置 -->
      <WebDAVConfig
        v-if="serverConfig.storageType === StorageType.WEBDAV"
        v-model="serverConfig.webdavConfig!"
        @save="saveWebDAVConfig"
      />

      <!-- 延迟退出时间设置 -->
      <div class="bg-white rounded-lg shadow p-4">
        <h2 class="text-lg font-semibold mb-4">延迟退出时间</h2>
        <p class="text-gray-600 text-sm mb-4">
          设置上传或下载操作完成后，延迟多少秒退出程序
        </p>

        <div class="space-y-3">
          <div class="flex items-center space-x-4">
            <label class="text-sm font-medium min-w-20">延迟时间：</label>
            <div class="flex items-center space-x-2 flex-1">
              <input
                v-model.number="exitDelay"
                @input="saveExitDelay"
                @blur="validateExitDelay"
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                class="border border-gray-300 rounded px-3 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-600">秒</span>
            </div>
          </div>
          <div class="text-xs text-gray-500 ml-24">
            输入 0 表示立即退出，支持小数（如 1.5）
          </div>
        </div>
      </div>

      <!-- 连接测试 -->
      <div class="bg-white rounded-lg shadow p-4">
        <h2 class="text-lg font-semibold mb-4">连接测试</h2>
        <p class="text-gray-600 text-sm mb-4">
          测试当前存储配置的连接状态
        </p>

        <button
          @click="testStorageConnection"
          :disabled="isTesting"
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          {{ isTesting ? '测试中...' : '测试存储连接' }}
        </button>

        <div
          v-if="testResult"
          :class="[
            'mt-4 p-3 rounded-md text-sm',
            testResult.success
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          ]"
        >
          {{ testResult.message }}
        </div>
      </div>

      <!-- 调试选项 -->
      <div class="bg-white rounded-lg shadow p-4">
        <h2 class="text-lg font-semibold mb-4">开发者选项</h2>
        <p class="text-gray-600 text-sm mb-4">
          调试和测试功能
        </p>

        <button
          @click="goToDebug"
          class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors"
        >
          🔧 调试页面
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import WebDAVConfig from '@/components/WebDAVConfig.vue'
import { useClipboardService, StorageType, type TestResult } from '@/services/clipboard-service'

const router = useRouter()
const exitDelay = ref<number>(0)
const isTesting = ref(false)
const testResult = ref<TestResult | null>(null)

// 使用剪贴板服务
const {
  serverConfig,
  switchStorageType,
  updateWebDAVConfig,
  testCurrentStorage,
  loadConfig,
  saveConfig
} = useClipboardService()

// 保存延迟退出时间到本地存储
function saveExitDelay() {
  localStorage.setItem('exitDelay', exitDelay.value.toString())
  console.log(`延迟退出时间已保存: ${exitDelay.value}秒`)
}

// 从本地存储加载延迟退出时间
function loadExitDelay() {
  const saved = localStorage.getItem('exitDelay')
  if (saved) {
    exitDelay.value = Number.parseFloat(saved)
  }
}

// 验证并修正延迟时间输入
function validateExitDelay() {
  // 确保值不为负数
  if (Number.isNaN(exitDelay.value) || exitDelay.value < 0) {
    exitDelay.value = 0
  }
  // 保留一位小数
  exitDelay.value = Math.round(exitDelay.value * 10) / 10
  saveExitDelay()
}

// 切换存储类型
async function handleSwitchStorageType(type: StorageType) {
  try {
    await switchStorageType(type)
    console.log(`存储类型已切换到: ${type}`)
    // 清除之前的测试结果
    testResult.value = null
  } catch (error) {
    console.error('切换存储类型失败:', error)
  }
}

// 保存 WebDAV 配置
async function saveWebDAVConfig(config: any) {
  try {
    await updateWebDAVConfig(config)
    console.log('WebDAV 配置已保存')
  } catch (error) {
    console.error('保存 WebDAV 配置失败:', error)
  }
}

// 测试存储连接
async function testStorageConnection() {
  if (isTesting.value) return

  isTesting.value = true
  testResult.value = null

  try {
    const result = await testCurrentStorage()
    testResult.value = result
  } catch (error) {
    testResult.value = {
      success: false,
      message: `连接测试失败: ${error}`
    }
  } finally {
    isTesting.value = false
  }
}

// 跳转到调试页面
function goToDebug() {
  router.push('/debug')
}

onMounted(async () => {
  loadExitDelay()
  // 加载剪贴板服务配置
  await loadConfig()
})
</script>

<style scoped>
.container {
  max-width: 600px;
}
</style>
