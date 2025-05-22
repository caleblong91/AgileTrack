# Caching System in AgileTrack

AgileTrack implements a sophisticated multi-level caching system to optimize performance and reduce load on external services.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Frontend Cache │─────│  Backend Cache  │─────│  External APIs  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Local Storage  │     │  Redis Cache    │     │  API Responses  │
│  (3-day expiry) │     │  (Celery)       │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Frontend Caching

### 1. Local Storage Cache
- **Duration**: 3 days (259200000 ms)
- **Storage**: Browser's localStorage
- **Usage**: Teams, integrations, and basic metrics
- **Implementation**:
```javascript
const localStorageCache = {
  get: function(key) {
    try {
      const cachedData = localStorage.getItem(`agiletrack_${key}`);
      if (!cachedData) return null;
      
      const { data, timestamp } = JSON.parse(cachedData);
      if (Date.now() - timestamp < 259200000) {
        return data;
      }
      return null;
    } catch (error) {
      return null;
    }
  },
  set: function(key, value) {
    try {
      const cacheObject = {
        data: value,
        timestamp: Date.now()
      };
      localStorage.setItem(`agiletrack_${key}`, JSON.stringify(cacheObject));
    } catch (error) {
      // Silent fail on storage errors
    }
  }
};
```

### 2. In-Memory Cache
- **Duration**: 4 hours (14400000 ms)
- **Storage**: JavaScript memory
- **Usage**: Session-specific metrics and frequently accessed data
- **Implementation**:
```javascript
const metricsCache = {
  data: {},
  timestamps: {},
  set: function(key, value) {
    this.data[key] = value;
    this.timestamps[key] = Date.now();
  },
  get: function(key) {
    if (this.data[key] && Date.now() - this.timestamps[key] < 14400000) {
      return this.data[key];
    }
    return null;
  }
};
```

## Backend Caching

### 1. Celery Result Backend
- **Storage**: Redis
- **Usage**: Task results and computed metrics
- **Configuration**:
```python
app = Celery('agiletrack', 
    broker=redis_url, 
    backend=redis_url,
    result_expires=3600  # 1 hour expiry
)
```

### 2. Database Query Caching
- **Storage**: PostgreSQL
- **Usage**: Frequently accessed data
- **Implementation**: Through SQLAlchemy's caching mechanisms

## Cache Invalidation

### 1. Automatic Invalidation
- Cache entries expire based on their TTL
- Data updates trigger cache invalidation
- Integration syncs clear relevant caches

### 2. Manual Invalidation
- Force refresh option in UI
- Admin-triggered cache clearing
- Error recovery cache clearing

## Cache Keys

### 1. Team Data
- `teams` - List of all teams
- `team_{id}` - Individual team data
- `team_{id}_integrations` - Team's integrations
- `team_{id}_metrics` - Team's metrics

### 2. Integration Data
- `integration_{id}` - Integration details
- `metrics_{integration_id}` - Integration metrics
- `last_sync_{integration_id}` - Last sync timestamp

## Best Practices

1. **Cache Size Management**
   - Regular cleanup of expired entries
   - Size limits for cached data
   - Compression for large datasets

2. **Error Handling**
   - Graceful fallback on cache misses
   - Silent fail for storage errors
   - Automatic retry mechanisms

3. **Performance Optimization**
   - Parallel cache updates
   - Batch cache operations
   - Efficient cache key design

4. **Security Considerations**
   - No sensitive data in localStorage
   - Encrypted cache data where needed
   - Proper cache isolation

## Monitoring

1. **Cache Hit Rates**
   - Track cache effectiveness
   - Monitor cache size
   - Log cache operations

2. **Performance Metrics**
   - Cache operation timing
   - Memory usage
   - Storage utilization

## Troubleshooting

### Common Issues

1. **Cache Misses**
   - Check TTL settings
   - Verify cache keys
   - Monitor invalidation triggers

2. **Storage Errors**
   - Check localStorage quota
   - Monitor Redis memory usage
   - Verify permissions

3. **Performance Issues**
   - Review cache size
   - Check cache hit rates
   - Monitor memory usage

### Debug Commands

```bash
# Clear all frontend caches
localStorage.clear()

# Check Redis cache status
redis-cli info memory

# Monitor cache operations
redis-cli monitor
```

## Future Improvements

1. **Planned Enhancements**
   - Implement cache warming
   - Add cache analytics
   - Improve cache compression

2. **Performance**
   - Optimize cache key structure
   - Implement cache sharding
   - Add cache preloading

3. **Monitoring**
   - Add cache metrics dashboard
   - Implement cache alerts
   - Improve logging

## Contributing

When modifying the caching system:

1. Follow existing patterns
2. Add appropriate error handling
3. Update documentation
4. Add tests for new cache features
5. Consider performance implications

## License

This document is part of the AgileTrack project and is subject to the same license terms. 