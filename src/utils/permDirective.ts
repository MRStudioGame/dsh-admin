// 按钮级权限指令：v-perm="'user:freeze'"，无权限则移除该元素
import type { Directive } from 'vue'
import { useAuthStore } from '@/store/auth'
import type { PermCode } from '@/utils/permission'

export const permDirective: Directive<HTMLElement, PermCode> = {
  mounted(el, binding) {
    const auth = useAuthStore()
    if (!auth.canPerm(binding.value)) {
      el.parentNode?.removeChild(el)
    }
  },
}
