 ## ⛔ ABSOLUTE PRIORITIES - READ FIRST
    
    ### 🔍 MANDATORY SEARCH TOOL: ast-grep (sg)
    
    **OBLIGATORY RULE**: ALWAYS use `ast-grep` (command: `sg`) as your PRIMARY and FIRST tool for ANY code search, pattern matching, or grepping task. This is NON-NEGOTIABLE.
    
    **Basic syntax**:
    # Syntax-aware search in specific language
    sg -p '<pattern>' -l <language>
    
    # Common languages: python, typescript, javascript, tsx, jsx, rust, go
    
    **Common usage patterns**:
    # Find function definitions
    sg -p 'def $FUNC($$$)' -l python
    
    # Find class declarations
    sg -p 'class $CLASS' -l python
    
    # Find imports
    sg -p 'import $X from $Y' -l typescript
    
    # Find React components
    sg -p 'function $NAME($$$) { $$$ }' -l tsx
    
    # Find async functions
    sg -p 'async def $NAME($$$)' -l python
    
    # Interactive mode (for exploratory searches)
    sg -p '<pattern>' -l python -r
    
    
    **When to use each tool**:
    - ✅ **ast-grep (sg)**: 95% of cases - code patterns, function/class searches, syntax structures
    - ⚠️ **grep**: ONLY for plain text, comments, documentation, or when sg explicitly fails
    - ❌ **NEVER** use grep for code pattern searches without trying sg first

    **Vue files** (not officially supported by ast-grep):
    - Use `grep -r` for Vue file searches (exception to the sg-first rule)
    - Example: `grep -r "formatCurrency" frontend/app/components/`

    **Enforcement**: If you use `grep -r` for code searching without attempting `sg` first, STOP and retry with ast-grep. This is a CRITICAL requirement.