# JarvisCoder Build Guide

## 🚀 Quick Start

### Step 1: Configure Update Server Address

Before building, run the configuration script to set up your update server:

```bash
# Set update server address and version
node scripts/setup-custom-update.js --server=https://updates.yourcompany.com --version=1.0.0

# Or set more options
node scripts/setup-custom-update.js \
  --server=https://updates.yourcompany.com \
  --version=1.2.3 \
  --name=MyCustomIDE \
  --quality=stable
```

### Step 2: Build Application

```bash
# Install dependencies
npm install

# Compile code
npm run compile

# Package application (generate installer)
npm run package
```

## 📁 Build Artifacts

After building is complete, you will get:

```
dist/
├── JarvisCoder-1.0.0-win32-x64.exe     # Windows 64-bit installer
├── JarvisCoder-1.0.0-win32-arm64.exe   # Windows ARM64 installer
├── JarvisCoder-1.0.0-darwin-x64.zip    # macOS Intel installer
├── JarvisCoder-1.0.0-darwin-arm64.zip  # macOS Apple Silicon installer
├── JarvisCoder-1.0.0-linux-x64.tar.gz  # Linux 64-bit installer
└── JarvisCoder-1.0.0-linux-arm64.tar.gz # Linux ARM64 installer
```

## 🔧 Configuration Options Explained

### Required Parameters

- `--server=URL`: Your update server address
  - Example: `https://updates.yourcompany.com`
  - The installed IDE will check for updates from this address

### Optional Parameters

- `--version=VERSION`: Application version number
  - Example: `1.2.3`
  - Format: `major.minor.patch`

- `--name=NAME`: Application name
  - Example: `MyCustomIDE`
  - Default: `JarvisCoder`

- `--quality=QUALITY`: Update channel
  - Available values: `stable`, `insider`
  - Default: `stable`

- `--commit=COMMIT`: Commit hash
  - Used for version identification
  - Default: `stable`

- `--appid=ID`: Application unique identifier
  - Used for Windows installer

## 🛠️ Build Process

### 1. Pre-build Configuration

```bash
# View current configuration
cat product.json | grep -E "(nameShort|updateUrl|version)"

# Configure update server
node scripts/setup-custom-update.js --server=https://your-server.com --version=1.0.0

# Verify configuration
cat build-info.json
```

### 2. Development Build

```bash
# Development mode build
npm run watch

# Start development server
npm run start
```

### 3. Production Build

```bash
# Clean old builds
npm run clean

# Full build
npm run compile

# Run tests
npm run test

# Package application
npm run package
```

### 4. Verify Build

```bash
# Check build artifacts
ls -la dist/

# Verify installer information
# Windows
signtool verify /pa dist/JarvisCoder-*.exe

# macOS
codesign -dv dist/JarvisCoder-*.zip

# Linux
file dist/JarvisCoder-*.tar.gz
```

## 📋 Build Environment Requirements

### System Requirements

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0 or **yarn**: >= 1.22.0
- **Python**: >= 3.7 (for building native modules)

### Platform-Specific Requirements

#### Windows
- Visual Studio Build Tools 2019/2022
- Windows SDK

#### macOS
- Xcode Command Line Tools
- macOS SDK

#### Linux
- GCC/Clang
- Related development libraries (libx11-dev, libxkbfile-dev, etc.)

### Install Build Tools

```bash
# Windows (use administrator privileges)
npm install -g windows-build-tools

# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential libx11-dev libxkbfile-dev

# CentOS/RHEL
sudo yum groupinstall "Development Tools"
sudo yum install libX11-devel libxkbfile-devel
```

## 🔧 Custom Build

### Modify Application Icon

Replace the following files:
```
resources/
├── win32/                    # Windows icons
│   ├── code.ico
│   └── inno-big-100.bmp
├── darwin/                   # macOS icons
│   └── code.icns
└── linux/                    # Linux icons
    ├── code.png
    └── code.svg
```

### Custom Splash Screen

Edit files:
```
src/vs/workbench/browser/parts/splash/
├── partsSplash.ts
└── media/
    └── code-icon.svg
```

### Add Custom Extensions

Add to `product.json`:
```json
{
  "builtInExtensions": [
    {
      "name": "your-extension",
      "version": "1.0.0",
      "repo": "https://github.com/yourusername/your-extension"
    }
  ]
}
```

## 🚀 Automated Build

### GitHub Actions

Create `.github/workflows/build.yml`:

```yaml
name: Build JarvisCoder

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    runs-on: ${{ matrix.os }}

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Configure update server
      run: |
        node scripts/setup-custom-update.js \
          --server=${{ secrets.UPDATE_SERVER_URL }} \
          --version=${{ github.ref_name }} \
          --quality=stable

    - name: Compile
      run: npm run compile

    - name: Package
      run: npm run package

    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: JarvisCoder-${{ matrix.os }}
        path: dist/
```

### GitLab CI/CD

Create `.gitlab-ci.yml`:

```yaml
stages:
  - build
  - package
  - deploy

variables:
  NODE_VERSION: "18"

before_script:
  - node --version
  - npm --version

build:
  stage: build
  image: node:${NODE_VERSION}
  script:
    - npm ci
    - node scripts/setup-custom-update.js --server=${UPDATE_SERVER_URL} --version=${CI_COMMIT_TAG}
    - npm run compile
  artifacts:
    paths:
      - out/
    expire_in: 1 hour
  only:
    - tags

package:windows:
  stage: package
  image: node:${NODE_VERSION}
  script:
    - npm run package
  artifacts:
    paths:
      - dist/
    expire_in: 1 week
  only:
    - tags
```

## 🐳 Docker Build

### Dockerfile

```dockerfile
FROM node:18-alpine as builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libx11-dev \
    libxkbfile-dev

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Configure and build
ARG UPDATE_SERVER_URL
ARG VERSION
RUN node scripts/setup-custom-update.js \
    --server=${UPDATE_SERVER_URL} \
    --version=${VERSION}

RUN npm run compile
RUN npm run package

# Runtime stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

### Docker Compose

```yaml
version: '3.8'

services:
  build:
    build:
      context: .
      args:
        UPDATE_SERVER_URL: https://updates.yourcompany.com
        VERSION: 1.0.0
    volumes:
      - ./dist:/app/dist
    environment:
      - NODE_ENV=production
```

## 📦 Distribution

### Signing and Notarization

#### Windows (Code Signing)
```bash
# Sign the executable
signtool sign /f cert.p12 /p password /t http://timestamp.digicert.com dist/JarvisCoder-*.exe

# Verify signature
signtool verify /pa dist/JarvisCoder-*.exe
```

#### macOS (Code Signing & Notarization)
```bash
# Sign the application
codesign --force --deep --sign "Developer ID Application: Your Name" dist/JarvisCoder-*.app

# Create DMG
hdiutil create -volname "JarvisCoder" -srcfolder dist/JarvisCoder-*.app -ov -format UDZO dist/JarvisCoder-*.dmg

# Sign DMG
codesign --sign "Developer ID Application: Your Name" dist/JarvisCoder-*.dmg

# Notarize
xcrun notarytool submit dist/JarvisCoder-*.dmg --keychain-profile "notarytool-password"
```

### Creating Checksums

```bash
# Generate checksums for all installers
cd dist/
sha256sum * > checksums.txt

# Or use specific tools
# Windows
certutil -hashfile JarvisCoder-*.exe SHA256

# macOS/Linux
shasum -a 256 JarvisCoder-*
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --grep "update"

# Run with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Test update mechanism
npm run test:update

# Test packaging
npm run test:package

# Test on different platforms
npm run test:cross-platform
```

### Manual Testing Checklist

- [ ] Application starts successfully
- [ ] Update check works with custom server
- [ ] All core features function properly
- [ ] Extensions load correctly
- [ ] Themes and settings persist
- [ ] Performance is acceptable
- [ ] No console errors on startup

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear build cache
npm run clean

# Rebuild native modules
npm rebuild
```

#### Update Server Issues
```bash
# Test update server connectivity
curl -I https://your-update-server.com/api/update/win32-x64/stable/stable

# Check configuration
cat product.json | grep updateUrl
cat build-info.json
```

#### Package Issues
```bash
# Check package contents
# Windows
7z l dist/JarvisCoder-*.exe

# macOS
pkgutil --payload-files dist/JarvisCoder-*.pkg

# Linux
tar -tzf dist/JarvisCoder-*.tar.gz
```

### Debug Mode

Enable debug logging:
```bash
# Set environment variable
export DEBUG=vscode:*

# Or use specific debug flags
export DEBUG=vscode:update,vscode:main

# Run with debug output
npm start 2>&1 | tee debug.log
```

### Performance Profiling

```bash
# Profile startup time
npm run profile:startup

# Profile memory usage
npm run profile:memory

# Profile build time
time npm run compile
```

## 📊 Monitoring and Analytics

### Build Metrics
- Build success/failure rates
- Build duration trends
- Package size analysis
- Dependency vulnerability reports

### Update Analytics
- Update check frequency
- Download success rates
- Version adoption rates
- Error rates and types

### Implementation Example
```javascript
// In your update server
app.get('/api/update/*', (req, res) => {
  // Log metrics
  analytics.track('update_check', {
    platform: req.query.platform,
    arch: req.query.arch,
    currentVersion: req.query.version,
    timestamp: Date.now()
  });

  // ... rest of update logic
});
```

## 🚀 Deployment Strategies

### Rolling Updates
- Deploy to staging environment first
- Gradual rollout to production users
- Monitor error rates and rollback if needed

### Blue-Green Deployment
- Maintain two identical production environments
- Switch traffic between environments
- Zero-downtime deployments

### Canary Releases
- Deploy to small subset of users first
- Monitor key metrics and user feedback
- Gradually increase deployment percentage

## 🔧 Advanced Configuration

### Custom Build Scripts

Create `scripts/custom-build.js`:
```javascript
const { execSync } = require('child_process');
const fs = require('fs');

function customBuild() {
  console.log('Starting custom build...');

  // Pre-build tasks
  execSync('node scripts/setup-custom-update.js --server=https://updates.company.com');

  // Custom compilation steps
  execSync('npm run compile');

  // Post-build tasks
  generateManifest();
  signBinaries();

  console.log('Custom build completed!');
}

function generateManifest() {
  const manifest = {
    name: 'JarvisCoder',
    version: process.env.BUILD_VERSION,
    buildDate: new Date().toISOString(),
    commit: process.env.GIT_COMMIT,
  };

  fs.writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
}

customBuild();
```

### Environment-Specific Builds

```bash
# Development build
NODE_ENV=development npm run build:dev

# Staging build
NODE_ENV=staging npm run build:staging

# Production build
NODE_ENV=production npm run build:prod
```

### Multi-Architecture Support

```bash
# Build for multiple architectures
npm run build -- --arch=x64,arm64

# Cross-compilation
npm run build:cross-platform
```

This comprehensive build guide provides everything needed to successfully build and deploy JarvisCoder with custom update functionality.
