# Metrics System in AgileTrack

AgileTrack calculates and analyzes various metrics to assess team performance and agile maturity.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Raw Data       │─────│  Metric         │─────│  Maturity       │
│  Collection     │     │  Calculation    │     │  Analysis       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Integration    │     │  Performance    │     │  Improvement    │
│  Metrics        │     │  Indicators     │     │  Suggestions    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Core Metrics

### 1. Velocity Metrics

#### Pull Request Velocity
```python
def calculate_pr_velocity(pr_data: List[dict]) -> float:
    """Calculate average PRs per week"""
    if not pr_data:
        return 0.0
    
    pr_dates = [parse_date(pr['created_at']) for pr in pr_data]
    weeks = (max(pr_dates) - min(pr_dates)).days / 7
    return len(pr_data) / max(weeks, 1)
```

#### Story Point Velocity
```python
def calculate_story_point_velocity(sprint_data: List[dict]) -> float:
    """Calculate average story points per sprint"""
    if not sprint_data:
        return 0.0
    
    completed_points = sum(sprint['completed_points'] for sprint in sprint_data)
    return completed_points / len(sprint_data)
```

### 2. Quality Metrics

#### Code Review Quality
```python
def calculate_review_quality(pr_data: List[dict]) -> float:
    """Calculate code review quality score"""
    if not pr_data:
        return 0.0
    
    scores = []
    for pr in pr_data:
        review_score = (
            pr.get('review_comments', 0) * 0.4 +
            pr.get('review_approvals', 0) * 0.6
        )
        scores.append(review_score)
    
    return sum(scores) / len(scores)
```

#### Test Coverage
```python
def calculate_test_coverage(commit_data: List[dict]) -> float:
    """Calculate test coverage percentage"""
    if not commit_data:
        return 0.0
    
    test_files = sum(1 for commit in commit_data 
                    if any(file.endswith('_test.py') for file in commit['files']))
    return (test_files / len(commit_data)) * 100
```

### 3. Collaboration Metrics

#### Team Participation
```python
def calculate_team_participation(activity_data: List[dict]) -> float:
    """Calculate team participation score"""
    if not activity_data:
        return 0.0
    
    unique_contributors = len(set(item['author'] for item in activity_data))
    total_activities = len(activity_data)
    return (unique_contributors / total_activities) * 100
```

#### Communication Frequency
```python
def calculate_communication_frequency(comment_data: List[dict]) -> float:
    """Calculate average comments per item"""
    if not comment_data:
        return 0.0
    
    return len(comment_data) / len(set(item['item_id'] for item in comment_data))
```

## Agile Maturity Calculation

### 1. Maturity Score Components

```python
def calculate_agile_maturity(metrics: dict) -> float:
    """Calculate overall agile maturity score"""
    weights = {
        'velocity': 0.3,
        'quality': 0.25,
        'collaboration': 0.25,
        'technical_debt': 0.2
    }
    
    scores = {
        'velocity': calculate_velocity_score(metrics),
        'quality': calculate_quality_score(metrics),
        'collaboration': calculate_collaboration_score(metrics),
        'technical_debt': calculate_technical_debt_score(metrics)
    }
    
    return sum(score * weights[component] 
              for component, score in scores.items())
```

### 2. Component Scoring

#### Velocity Score
```python
def calculate_velocity_score(metrics: dict) -> float:
    """Calculate velocity component score"""
    velocity = metrics.get('velocity', 0)
    consistency = metrics.get('velocity_consistency', 0)
    
    return (velocity * 0.6 + consistency * 0.4) * 100
```

#### Quality Score
```python
def calculate_quality_score(metrics: dict) -> float:
    """Calculate quality component score"""
    review_quality = metrics.get('review_quality', 0)
    test_coverage = metrics.get('test_coverage', 0)
    defect_rate = metrics.get('defect_rate', 0)
    
    return (
        review_quality * 0.4 +
        test_coverage * 0.4 +
        (100 - defect_rate) * 0.2
    )
```

## Metric Visualization

### 1. Dashboard Components
- Velocity trends
- Quality metrics
- Collaboration indicators
- Technical debt tracking

### 2. Chart Types
- Line charts for trends
- Bar charts for comparisons
- Radar charts for maturity
- Heat maps for activity

## Best Practices

1. **Data Collection**
   - Regular sync intervals
   - Data validation
   - Error handling
   - Backup mechanisms

2. **Calculation**
   - Consistent formulas
   - Weighted averages
   - Normalization
   - Outlier handling

3. **Analysis**
   - Trend identification
   - Pattern recognition
   - Comparative analysis
   - Goal tracking

## Monitoring

1. **Metric Health**
   - Data freshness
   - Calculation accuracy
   - Update frequency
   - Error rates

2. **Performance**
   - Calculation time
   - Resource usage
   - Cache effectiveness
   - API response times

## Troubleshooting

### Common Issues

1. **Data Quality**
   - Missing data
   - Inconsistent values
   - Outlier detection
   - Data validation

2. **Calculation Errors**
   - Formula verification
   - Input validation
   - Error logging
   - Recovery procedures

### Debug Commands

```bash
# Check metric calculations
curl -H "Authorization: Bearer <token>" http://localhost:8000/metrics/debug/<team_id>

# Force metric recalculation
curl -X POST -H "Authorization: Bearer <token>" http://localhost:8000/metrics/recalculate/<team_id>

# View metric logs
tail -f /var/log/agiletrack/metrics.log
```

## Future Improvements

1. **Enhanced Metrics**
   - Custom metric definitions
   - Advanced analytics
   - Machine learning insights
   - Predictive metrics

2. **Visualization**
   - Interactive dashboards
   - Custom reports
   - Export capabilities
   - Real-time updates

3. **Analysis**
   - Automated insights
   - Trend prediction
   - Comparative analysis
   - Goal tracking

## Contributing

When modifying metrics:

1. Follow calculation standards
2. Add comprehensive tests
3. Update documentation
4. Include validation
5. Consider performance

## License

This document is part of the AgileTrack project and is subject to the same license terms. 