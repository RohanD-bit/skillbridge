import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())
if (typeof window !== 'undefined') window.scrollTo = vi.fn()
