'use client'

import * as React from 'react'
import { signIn } from 'next-auth/react'

import { cn } from '@/lib/utils'
import { Button, type ButtonProps } from '@/components/ui/button'
import { IconsMicrosoft, IconSpinner } from '@/components/ui/icons'

interface MicrosoftLoginButtonProps extends ButtonProps {
  showMicrosoftIcon?: boolean
  text?: string
}

export function MicorsoftLoginButton({
  text = 'Login with Micorsoft Azure',
  showMicrosoftIcon = true,
  className,
  ...props
}: MicrosoftLoginButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  return (
    <Button
      variant="outline"
      onClick={() => {
        setIsLoading(true)
        // next-auth signIn() function doesn't work yet at Edge Runtime due to usage of BroadcastChannel
        signIn('azure-ad', { callbackUrl: `/` })
      }}
      disabled={isLoading}
      className={cn(className)}
      {...props}
    >
      {isLoading ? (
        <IconSpinner className="mr-2 animate-spin" />
      ) : showMicrosoftIcon ? (
        <IconsMicrosoft className="mr-2" />
      ) : null}
      {text}
    </Button>
  )
}
