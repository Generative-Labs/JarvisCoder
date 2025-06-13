# Patch Files Documentation

## gettingStarted.patch

This patch file contains custom modifications to `gettingStarted.ts` to prevent it from being overwritten when syncing with the stream branch.

### Usage

1. After syncing with the stream branch, apply the patch:

   ```bash
   git apply patches/gettingStarted.patch
   ```

2. If conflicts occur, resolve them manually and then:
   ```bash
   git add src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
   git commit -m "chore: reapply getting started page customization"
   ```

## product.patch

This patch file contains custom modifications to `product.json` for product information customization.

### Usage

1. After syncing with the stream branch, apply the patch:

   ```bash
   git apply patches/product.patch
   ```

2. If conflicts occur, resolve them manually and then:
   ```bash
   git add product.json
   git commit -m "chore: reapply product customization"
   ```

## product_type.patch

This patch file contains custom modifications to `product.type.ts` for product type definition customization.

### Usage

1. After syncing with the stream branch, apply the patch:

   ```bash
   git apply patches/product_type.patch
   ```

2. If conflicts occur, resolve them manually and then:
   ```bash
   git add src/vs/platform/product/common/product.type.ts
   git commit -m "chore: reapply product type customization"
   ```

### Notes

- All patches need to be reapplied after each sync with the stream branch
- If a patch file becomes invalid, it needs to be regenerated
- It's recommended to backup current modifications before applying patches
- Recommended patch application order:
  1. product_type.patch
  2. product.patch
  3. gettingStarted.patch
