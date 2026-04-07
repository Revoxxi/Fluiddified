import type { DirectiveOptions } from 'vue'
import type { Permission } from '@/types/auth'

function checkPermission (el: HTMLElement, permission: Permission, store: any) {
  if (!store?.getters['auth/hasPermission'](permission)) {
    el.style.display = 'none'
  } else {
    el.style.display = ''
  }
}

const PermissionDirective: DirectiveOptions = {
  bind (el, binding, vnode) {
    checkPermission(el, binding.value, vnode.context?.$store)
  },
  update (el, binding, vnode) {
    checkPermission(el, binding.value, vnode.context?.$store)
  }
}

export default PermissionDirective
