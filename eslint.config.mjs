import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config({
    files: ["src/**/*.ts"],
    extends: [
        js.configs.recommended,
        ...tseslint.configs.strictTypeChecked,
        ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node,
            ...globals.es2022,
        },
        parserOptions: {
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
        },
    },
    rules: {
        "no-undef": "off",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/restrict-template-expressions": [
            "error",
            { allowNumber: true },
        ],
        "no-restricted-syntax": [
            "error",
            {
                selector:
                    "BinaryExpression[operator='==='][right.type='Literal'][right.value=null]",
                message:
                    "Use == null for nullish checks (null or undefined).",
            },
            {
                selector:
                    "BinaryExpression[operator='==='][left.type='Literal'][left.value=null]",
                message:
                    "Use == null for nullish checks (null or undefined).",
            },
            {
                selector:
                    "BinaryExpression[operator='!=='][right.type='Literal'][right.value=null]",
                message:
                    "Use != null for nullish checks (null or undefined).",
            },
            {
                selector:
                    "BinaryExpression[operator='!=='][left.type='Literal'][left.value=null]",
                message:
                    "Use != null for nullish checks (null or undefined).",
            },
            {
                selector:
                    "BinaryExpression[operator='=='][right.type='Identifier'][right.name='undefined']",
                message:
                    "Use == null instead of comparing to undefined.",
            },
            {
                selector:
                    "BinaryExpression[operator='=='][left.type='Identifier'][left.name='undefined']",
                message:
                    "Use == null instead of comparing to undefined.",
            },
            {
                selector:
                    "BinaryExpression[operator='!='][right.type='Identifier'][right.name='undefined']",
                message:
                    "Use != null instead of comparing to undefined.",
            },
            {
                selector:
                    "BinaryExpression[operator='!='][left.type='Identifier'][left.name='undefined']",
                message:
                    "Use != null instead of comparing to undefined.",
            },
            {
                selector:
                    "BinaryExpression[operator='==='][right.type='Identifier'][right.name='undefined']",
                message:
                    "Use == null for nullish checks (null or undefined).",
            },
            {
                selector:
                    "BinaryExpression[operator='==='][left.type='Identifier'][left.name='undefined']",
                message:
                    "Use == null for nullish checks (null or undefined).",
            },
            {
                selector:
                    "BinaryExpression[operator='!=='][right.type='Identifier'][right.name='undefined']",
                message:
                    "Use != null for nullish checks (null or undefined).",
            },
            {
                selector:
                    "BinaryExpression[operator='!=='][left.type='Identifier'][left.name='undefined']",
                message:
                    "Use != null for nullish checks (null or undefined).",
            },
            {
                selector:
                    "BinaryExpression[operator='==']:not([right.type='Literal'][right.value=null]):not([left.type='Literal'][left.value=null]):not([right.type='Identifier'][right.name='undefined']):not([left.type='Identifier'][left.name='undefined'])",
                message:
                    "Use strict equality (===). Only use == null for nullish checks.",
            },
            {
                selector:
                    "BinaryExpression[operator='!=']:not([right.type='Literal'][right.value=null]):not([left.type='Literal'][left.value=null]):not([right.type='Identifier'][right.name='undefined']):not([left.type='Identifier'][left.name='undefined'])",
                message:
                    "Use strict inequality (!==). Only use != null for nullish checks.",
            },
            {
                selector:
                    ":matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > :matches(Identifier, ObjectPattern, ArrayPattern)[optional=true].params",
                message:
                    "Do not use `?` on function implementation parameters. Use a required parameter with a default value, or `value: T | null = null`.",
            },
        ],
    },
});
