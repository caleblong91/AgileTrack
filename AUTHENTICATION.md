# Authentication System in AgileTrack

AgileTrack implements a secure JWT-based authentication system with comprehensive token management and protected routes.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │─────│  FastAPI Backend│─────│  PostgreSQL DB  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  JWT Token      │     │  Token          │     │  User Data      │
│  Management     │     │  Validation     │     │  Storage        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Authentication Flow

1. **Login Process**
   ```javascript
   const login = async (email, password) => {
     try {
       const response = await api.post('/auth/login', {
         email,
         password
       });
       
       const { access_token } = response.data;
       localStorage.setItem('token', access_token);
       setToken(access_token);
       
       // Fetch user data
       const userData = await fetchUserData();
       return userData;
     } catch (error) {
       throw error;
     }
   };
   ```

2. **Token Management**
   - Tokens stored in localStorage
   - Automatic token inclusion in API requests
   - Token refresh mechanism
   - Secure token handling

3. **Protected Routes**
   ```javascript
   const ProtectedRoute = () => {
     const { currentUser, loading } = useAuth();
     
     if (loading) {
       return <LoadingSpinner />;
     }
     
     return currentUser ? <Outlet /> : <Navigate to="/login" />;
   };
   ```

## Security Features

### 1. Password Security
- Bcrypt password hashing
- Secure password requirements
- Password reset functionality
- Account lockout after failed attempts

### 2. Token Security
- JWT token expiration (24 hours)
- Secure token storage
- Token refresh mechanism
- Automatic token cleanup

### 3. API Security
- HTTPS enforcement
- CORS configuration
- Rate limiting
- Request validation

## User Management

### 1. User Registration
```python
@router.post("/register")
async def register(user: UserCreate):
    # Check if user exists
    if await get_user_by_email(user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    user_data = user.dict()
    user_data["hashed_password"] = hashed_password
    
    return await create_user(user_data)
```

### 2. User Profile
- Email verification
- Profile updates
- Password changes
- Account deletion

### 3. Session Management
- Active session tracking
- Session timeout
- Multiple device handling
- Session invalidation

## Error Handling

### 1. Authentication Errors
```javascript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 2. Common Error Types
- Invalid credentials
- Expired tokens
- Missing permissions
- Rate limit exceeded

## Best Practices

1. **Token Management**
   - Secure storage
   - Regular rotation
   - Proper expiration
   - Refresh mechanism

2. **Password Security**
   - Strong hashing
   - Salt usage
   - Minimum requirements
   - Regular updates

3. **Session Security**
   - Timeout handling
   - Device tracking
   - Activity monitoring
   - Secure logout

## Monitoring

1. **Security Monitoring**
   - Failed login attempts
   - Token usage
   - Session activity
   - API access patterns

2. **Performance Monitoring**
   - Authentication latency
   - Token validation time
   - Session management overhead
   - API response times

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Check token validity
   - Verify credentials
   - Check permissions
   - Review error logs

2. **Session Problems**
   - Check session timeout
   - Verify token expiration
   - Review device limits
   - Check activity logs

### Debug Commands

```bash
# Check token validity
curl -H "Authorization: Bearer <token>" http://localhost:8000/auth/me

# Monitor authentication logs
tail -f /var/log/agiletrack/auth.log

# Check user sessions
redis-cli keys "session:*"
```

## Future Improvements

1. **Security Enhancements**
   - Two-factor authentication
   - OAuth integration
   - Biometric authentication
   - Enhanced encryption

2. **User Experience**
   - Remember me functionality
   - Social login options
   - Single sign-on
   - Enhanced profile management

3. **Monitoring**
   - Real-time security alerts
   - Enhanced logging
   - User activity tracking
   - Security analytics

## Contributing

When modifying the authentication system:

1. Follow security best practices
2. Add appropriate error handling
3. Update documentation
4. Add security tests
5. Consider backward compatibility

## License

This document is part of the AgileTrack project and is subject to the same license terms. 