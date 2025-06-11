# Custom Update API Implementation

JarvisCoder supports fetching updates from your own API server instead of Microsoft's update servers. This document explains how to set up and use this feature.

## Features

- ✅ **Minimal Changes**: Only two files modified in the VS Code codebase
- ✅ **Full Compatibility**: Falls back to default VS Code update mechanism if no custom URL is set
- ✅ **Cross-Platform**: Works on Windows, macOS, and Linux automatically
- ✅ **Rich Context**: Sends platform, architecture, version info to your API
- ✅ **Production Ready**: Includes proper error handling and logging

## Configuration

**Configuration Options:**
- **update.customFeedUrl**: Your custom update server URL (leave empty to use default VS Code updates)
- **update.mode**: Update mode - "default", "start", "manual", or "none"

## API Server Requirements

Your update server should implement the following endpoint:

### GET /api/ide/updates

**Query Parameters Sent by JarvisCoder:**
- `platform`: OS platform (`win32`, `darwin`, `linux`)
- `arch`: CPU architecture (`x64`, `arm64`, etc.)
- `version`: Current JarvisCoder version
- `quality`: Update quality (`stable`, `insider`, etc.)
- `commit`: Current commit hash
- `timestamp`: Request timestamp

**Response Format:**

#### No Updates Available
Return HTTP status `204 No Content`

#### Update Available
Return HTTP status `200 OK` with JSON:

```json
{
  "version": "1.2.3",
  "productVersion": "1.2.3",
  "url": "https://your-server.com/downloads/JarvisCoder-1.2.3-win32-x64.exe",
  "sha256hash": "abc123...", // Optional: SHA256 hash for verification
  "timestamp": 1234567890
}
```

## Example API Server Implementation

```python
from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.responses import JSONResponse, Response
import hashlib
import time

app = FastAPI()

@app.get("/api/ide/updates")
async def check_updates(
    platform: str = Query(...),
    arch: str = Query(...),
    version: str = Query(...),
    quality: str = Query(None),
    commit: str = Query(None)
):
    print(f"Update check: {platform}-{arch}, current: {version}")

    latest_version = get_latest_version(platform, arch, quality)

    if not latest_version or version == latest_version['version']:
        # No update available
        return Response(status_code=204)

    file_ext = get_file_extension(platform)
    download_url = f"https://your-server.com/downloads/JarvisCoder-{latest_version['version']}-{platform}-{arch}{file_ext}"

    return JSONResponse(content={
        'version': latest_version['version'],
        'productVersion': latest_version['version'],
        'url': download_url,
        'sha256hash': latest_version.get('sha256hash'),
        'timestamp': int(time.time() * 1000)
    })


def get_file_extension(platform: str) -> str:
    extensions = {
        'win32': '.exe',
        'darwin': '.zip',
        'linux': '.AppImage'
    }
    return extensions.get(platform, '.zip')


def get_latest_version(platform: str, arch: str, quality: str = None) -> dict:
    # Dummy data; replace with DB or file lookup logic as needed
    return {
        'version': '1.2.3',
        'sha256hash': 'abc123...'
    }

# Run with: uvicorn app:app --host 0.0.0.0 --port 3000
```

## File Structure for Downloads

Organize your download files with a clear naming convention:

```
downloads/
├── JarvisCoder-1.2.3-win32-x64.exe
├── JarvisCoder-1.2.3-darwin-x64.zip
├── JarvisCoder-1.2.3-darwin-arm64.zip
├── JarvisCoder-1.2.3-linux-x64.AppImage
└── JarvisCoder-1.2.3-linux-arm64.AppImage
```

## Security Considerations

1. **HTTPS**: Always use HTTPS for your update server
2. **Checksums**: Provide SHA256 hashes for file verification
3. **Access Control**: Implement proper authentication if needed
4. **Rate Limiting**: Protect your server from abuse
5. **File Validation**: Validate all uploaded files before serving

## Deployment Options

### Cloud Platforms
- **AWS**: Use S3 + CloudFront + Lambda/API Gateway
- **Google Cloud**: Use Cloud Storage + Cloud Functions
- **Azure**: Use Blob Storage + Azure Functions
- **Netlify/Vercel**: For serverless deployment

### Self-Hosted
- Docker containers with nginx reverse proxy
- Traditional VPS with web server
- On-premise infrastructure

## Testing

Test your update server with curl:

```bash
# Test update check
curl "https://your-server.com/api/ide/updates?platform=win32&arch=x64&version=1.0.0&quality=stable&commit=abc123&timestamp=1234567890"

# Should return either 204 (no updates) or 200 with update JSON
```

## Logging and Monitoring

Your API server should log:
- Update check requests with user agent and IP
- Version comparisons and decisions
- Download requests and completion status
- Error conditions and their resolutions

Example log format:
```
[2024-01-15 10:30:45] UPDATE_CHECK platform=win32 arch=x64 current=1.0.0 latest=1.2.3 update_available=true ip=192.168.1.1
[2024-01-15 10:31:12] DOWNLOAD_START version=1.2.3 platform=win32 arch=x64 ip=192.168.1.1
[2024-01-15 10:33:45] DOWNLOAD_COMPLETE version=1.2.3 platform=win32 arch=x64 size=128MB duration=2m33s ip=192.168.1.1
```

## Troubleshooting

### Common Issues

1. **Updates not detected**
   - Check if `update.customFeedUrl` is set correctly
   - Verify your API returns proper JSON format
   - Check JarvisCoder logs for error messages

2. **Download failures**
   - Ensure download URLs are publicly accessible
   - Verify file checksums if provided
   - Check file permissions and server configuration

3. **Version comparison issues**
   - Implement semantic version comparison
   - Consider pre-release versions and build numbers
   - Test with different version formats

### Debug Mode

Enable detailed logging by setting the log level in JarvisCoder:
```json
{
  "log.level": "debug"
}
```

Then check the logs in:
- **Windows**: `%APPDATA%\JarvisCoder\logs\`
- **macOS**: `~/Library/Application Support/JarvisCoder/logs/`
- **Linux**: `~/.config/JarvisCoder/logs/`

## Production Checklist

- [ ] HTTPS certificate configured and valid
- [ ] API server handles all required query parameters
- [ ] Proper HTTP status codes returned (204/200)
- [ ] JSON response format matches specification
- [ ] File checksums calculated and verified
- [ ] Download URLs are publicly accessible
- [ ] Error handling and logging implemented
- [ ] Rate limiting and security measures in place
- [ ] Monitoring and alerting configured
- [ ] Backup and disaster recovery plan ready

## Support

For questions and issues related to the custom update implementation:

1. Check the JarvisCoder logs for detailed error messages
2. Verify your API server responses match the specification
3. Test your endpoints manually with curl or similar tools
4. Review the server logs for any error conditions

---

This implementation provides a robust, production-ready solution for custom updates while maintaining minimal changes to the VS Code codebase.
