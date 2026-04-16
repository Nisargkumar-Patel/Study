import { createContext, useContext, useState, HTMLAttributes, ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextType>({ value: '', onValueChange: () => {} })

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue: string
  onValueChange?: (value: string) => void
}

function Tabs({ defaultValue, onValueChange, children, className, ...props }: TabsProps) {
  const [value, setValue] = useState(defaultValue)
  const handleChange = (val: string) => {
    setValue(val)
    onValueChange?.(val)
  }
  return (
    <TabsContext.Provider value={{ value, onValueChange: handleChange }}>
      <div className={cn('w-full', className)} {...props}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  const ctx = useContext(TabsContext)
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        ctx.value === value && 'bg-background text-foreground shadow-sm',
        className
      )}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    />
  )
}

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
}

function TabsContent({ className, value, ...props }: TabsContentProps) {
  const ctx = useContext(TabsContext)
  if (ctx.value !== value) return null
  return (
    <div
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
