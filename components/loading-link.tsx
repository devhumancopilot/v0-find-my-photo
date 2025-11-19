"use client"

interface LoadingLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  loadingMessage?: string
}

export function LoadingLink({ href, children, className }: LoadingLinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}
