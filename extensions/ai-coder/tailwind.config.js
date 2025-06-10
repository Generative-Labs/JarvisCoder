/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  plugins: [],

  theme: {
    extend: {
      fontFamily: {
        inter: ["Inter", "sans-serif"],
        "funnel-sans": ["Funnel Sans", "sans-serif"],
      },
      fontSize: {
        'caption2': ['10px', { lineHeight: '13px', letterSpacing: '0em' }],
        'caption1': ['var(--vscode-editor-fontSize)', { lineHeight: '16px', letterSpacing: '0em' }],
        'body': ['var(--vscode-editor-fontSize)', { lineHeight: '20px', letterSpacing: '0em' }],
        'headline': ['var(--vscode-editor-fontSize)', { lineHeight: '20px', letterSpacing: '0em' }],
        'title3': ['var(--vscode-editor-fontSize)', { lineHeight: '22px', letterSpacing: '0em' }],
        'title2': ['24px', { lineHeight: '28px', letterSpacing: '0em' }],
        'title1': ['32px', { lineHeight: '38px', letterSpacing: '0em' }],
      },
      fontWeight: {
        'regular': '400',
        'medium': '500', 
        'bold': '700',
      },
      colors: {
        // standard color
        "ai-gray-01": "var(--vscode-editor-foreground)",
        "ai-bg-01": "var(--vscode-sideBar-background)",
        "ai-line-4%": "var(--vscode-inputValidation-infoBorder)",
        "ai-line-6%": "var(--vscode-inputValidation-infoBorder)",
        "ai-line-8%": "var(--vscode-input-border)",
        "ai-line-12%": "var(--vscode-menu-selectionBorder)",
        "ai-line-default": "rgba(32, 32, 32, 1)",
        "ai-bg-02": "var(--vscode-editor-background)",
        "ai-bg-03": "var(--vscode-editor-background)",
        "ai-bg-04": "var(--vscode-sideBar-dropBackground)",
        "ai-bg-05": "var(--vscode-button-secondaryBackground)",
        "ai-bg-06": "var(--vscode-button-hoverBackground)",
        "ai-primary-01": "rgba(254, 231, 25, 1)",
        "ai-primary-02": "rgba(221, 179, 5, 1)",
        "ai-primary-03": "rgba(63, 57, 0, 1)",
        "ai-gray-02": "rgba(244, 244, 245, 1)",
        "ai-gray-03": "var(--vscode-button-secondaryForeground)",
        "ai-gray-04": "var(--vscode-statusBar-foreground)",
        "ai-gray-05": "var(--vscode-disabledForeground)",
        "ai-gray-06": "rgba(70, 70, 70, 1)",
        "ai-gray-07": "rgba(27, 27, 27, 1)",
        "ai-primary-green-01": "rgba(6, 199, 86, 1)",
        "ai-primary-green-02": "rgba(1, 175, 88, 1)",
        "ai-primary-green-03": "rgba(14, 62, 34, 1)",
        "ai-primary-blue-01": "var(--vscode-button-background)",
        "ai-gray-bg": "rgba(247, 247, 247, 1)",
        "ai-primary-red-red": "rgba(239, 68, 68, 1)",
        "bubble-border": "var(--vscode-panel-border)",
        "success-bg": "var(--vscode-button-background)",
        "code-block-border-color": 'var(--vscode-panel-border)'
      },
    },
  },
};