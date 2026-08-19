import { defineConfig } from 'vitest/config';

// 仅运行根目录 tests/ 下的测试；被测代码位于 assets/scripts（core 不依赖 cc）
export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
    },
});
