import Vue from 'vue'
import { Component } from 'vue-property-decorator'
import type { Role, Permission } from '@/types/auth'

@Component({})
export default class AuthMixin extends Vue {
  get currentRole (): Role {
    return this.$typedGetters['auth/getCurrentRole']
  }

  get isOwner (): boolean {
    return this.$typedGetters['auth/isOwner']
  }

  get isUser (): boolean {
    return this.$typedGetters['auth/isUser']
  }

  get isGuest (): boolean {
    return this.$typedGetters['auth/isGuest']
  }

  hasPermission (permission: Permission): boolean {
    return this.$typedGetters['auth/hasPermission'](permission)
  }

  hasMinRole (role: Role): boolean {
    return this.$typedGetters['auth/hasMinRole'](role)
  }
}
