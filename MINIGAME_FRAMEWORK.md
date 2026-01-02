# Mini-Game Tab Integration Framework

## Overview
This framework explains how to integrate mini-games into tabs within ObjectInvestigation.razor, based on the existing Physical and Spectroscopy tab implementations.

## Core Pattern

### 1. Tab State Management
```csharp
// Add these variables to @code section
private bool [tabName]Loaded = false;
private bool [tabName]Loading = false;
private IJSObjectReference? [tabName]GameRef;

// For content loading states
private bool [tabName]LeftLoaded = false;
private bool [tabName]TopLoaded = false; 
private bool [tabName]BottomLoaded = false;
```

### 2. Tab HTML Structure
```html
<!-- In tabs section -->
<button class="tab @(activeTab == "[tabname]" ? "active" : "") @(![previousTab]Loaded ? "disabled" : "")" 
        @onclick="Set[TabName]Tab" 
        disabled="@(![previousTab]Loaded)">[TAB DISPLAY NAME]</button>

<!-- In content-box section -->
else if (activeTab == "[tabname]")
{
    @if ([tabName]Loading)
    {
        <div class="loading-animation">
            <p>[LOADING MESSAGE]...</p>
            <div class="loading-dots">...</div>
        </div>
    }
    else if (![tabName]Loaded)
    {
        <!-- MINI-GAME SECTION -->
        <div class="mini-game" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <h4>[GAME TITLE]</h4>
            <canvas id="[gameCanvasId]" width="640" height="480" style="border: 2px solid #fff; background: #000; cursor: crosshair; max-width: 100%; max-height: 400px;"></canvas>
            <div class="game-controls" style="margin-top: 10px;">
                <p style="margin: 5px 0;">[GAME INSTRUCTIONS]</p>
                <button @onclick="Reset[GameName]Game" style="margin-right: 10px;">RESET</button>
                <button @onclick="AutoSolve[TabName]" class="debug-btn" style="padding: 5px 10px; font-size: 10px;">DEBUG</button>
            </div>
        </div>
    }
    else
    {
        <!-- RESULTS SECTION -->
        <div class="content-layout">
            <div class="left-image @([tabName]LeftLoaded ? "loaded" : "")">
                @if ([tabName]LeftLoaded)
                {
                    <!-- Left panel content -->
                }
            </div>
            <div class="right-panel">
                <div class="top-right-image @([tabName]TopLoaded ? "loaded" : "")">
                    @if ([tabName]TopLoaded)
                    {
                        <!-- Top right content -->
                    }
                </div>
                <div class="bottom-right-data @([tabName]BottomLoaded ? "loaded" : "")">
                    @if ([tabName]BottomLoaded)
                    {
                        <!-- Bottom right data -->
                    }
                </div>
            </div>
        </div>
    }
}
```

### 3. JavaScript Game File Structure
Create `[game-name].js` in wwwroot:

```javascript
window.init[GameName]Game = (canvasId) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // Game state variables
    let gameState = 'playing';
    let gameComplete = false;
    
    // Game logic functions
    const render = () => {
        // Rendering code
    };
    
    const updateGame = () => {
        // Game update logic
        // Set gameComplete = true when finished
    };
    
    // Event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    
    // Initialize game
    render();
    
    // Return game interface
    return {
        reset: () => {
            // Reset game state
            gameComplete = false;
            render();
        },
        isComplete: () => gameComplete
    };
};
```

### 4. C# Integration Methods
```csharp
// Initialize game in OnAfterRenderAsync
private async Task Initialize[GameName]Game()
{
    try
    {
        [tabName]GameRef = await JSRuntime.InvokeAsync<IJSObjectReference>("init[GameName]Game", "[gameCanvasId]");
        
        _ = Task.Run(async () => {
            while (![tabName]Loaded)
            {
                await Task.Delay(1000);
                await Check[GameName]Success();
            }
        });
    }
    catch { }
}

// Check for game completion
private async Task Check[GameName]Success()
{
    try
    {
        if ([tabName]GameRef != null && ![tabName]Loaded)
        {
            var isSuccess = await [tabName]GameRef.InvokeAsync<bool>("isComplete");
            if (isSuccess)
            {
                [tabName]Loading = true;
                await InvokeAsync(StateHasChanged);
                
                await Task.Delay(2000); // Loading delay
                
                [tabName]Loaded = true;
                [tabName]Loading = false;
                
                // Load content with staggered animation
                Reset[TabName]Images();
                await Task.Delay(200);
                [tabName]LeftLoaded = true;
                await InvokeAsync(StateHasChanged);
                
                await Task.Delay(400);
                [tabName]TopLoaded = true;
                await InvokeAsync(StateHasChanged);
                
                await Task.Delay(600);
                [tabName]BottomLoaded = true;
                await InvokeAsync(StateHasChanged);
                
                await CheckAllTabsComplete();
            }
        }
    }
    catch { }
}

// Reset and debug methods
private async Task Reset[GameName]Game()
{
    try
    {
        if ([tabName]GameRef != null)
        {
            await [tabName]GameRef.InvokeVoidAsync("reset");
        }
    }
    catch { }
}

private async Task AutoSolve[TabName]()
{
    [tabName]Loading = true;
    StateHasChanged();
    
    await Task.Delay(2000);
    
    [tabName]Loaded = true;
    [tabName]Loading = false;
    await Load[TabName]Data();
    StateHasChanged();
}

// Tab switching
private void Set[TabName]Tab() 
{ 
    if ([previousTab]Loaded) 
    {
        activeTab = "[tabname]";
        StateHasChanged();
        _ = Task.Run(async () => {
            await Task.Delay(100);
            if (activeTab == "[tabname]" && ![tabName]Loaded)
            {
                await Initialize[GameName]Game();
            }
        });
    }
}

// Image reset helper
private void Reset[TabName]Images() 
{ 
    [tabName]LeftLoaded = [tabName]TopLoaded = [tabName]BottomLoaded = false; 
}
```

### 5. Script Reference
Add to Components/App.razor in `<head>`:
```html
<script src="[game-name].js"></script>
```

## Key Implementation Details

### Game Completion Flow
1. **Game Active**: Mini-game runs until completion condition met
2. **Loading State**: Shows loading animation for 2 seconds
3. **Content Load**: Staggered image/content loading with animations
4. **Tab Unlock**: Next tab becomes available

### Success Detection
- Use polling every 1 second to check `isComplete()`
- Game returns `true` when player succeeds
- Triggers loading sequence automatically

### Visual Consistency
- All games use 640x480 canvas with 1-bit pixelated style
- Loading animations match existing pattern
- Staggered content loading (200ms, 400ms, 600ms delays)
- CSS classes: `.loaded` for animations

## Common Issues and Solutions

### Game Not Rendering
**Problem**: Canvas games don't render when tab becomes active
**Solution**: Always check tab state before initializing games
```csharp
if (activeTab == "[tabname]" && ![tabName]Loaded)
{
    await Initialize[GameName]Game();
}
```
**Why**: Prevents initialization when user has already switched to another tab

### Canvas Element Not Found
**Problem**: JavaScript error "Canvas not found: [canvasId]"
**Solution**: Ensure canvas ID in HTML matches JavaScript function parameter
```html
<!-- HTML canvas ID must match -->
<canvas id="spectroscopyCanvas" width="640" height="480"></canvas>
```
```csharp
// C# call must use same ID
rayDeflectionGameRef = await JSRuntime.InvokeAsync<IJSObjectReference>("initRayDeflectionGame", "spectroscopyCanvas");
```
**Why**: JavaScript cannot find DOM element if IDs don't match

### JavaScript Syntax Errors
**Problem**: "Uncaught SyntaxError: Invalid or unexpected token"
**Solution**: Check for escaped newlines in JavaScript files
**Common Cause**: File contains `\\n` instead of actual newlines
**Fix**: Recreate JavaScript file with proper line breaks
**Why**: Escaped characters break JavaScript parsing

### Error Handling
- Wrap all JS interop in try-catch blocks
- Provide debug auto-solve buttons
- Reset functionality for stuck games

## Example Implementation Checklist

For each new mini-game tab:
- [ ] Add state variables to @code
- [ ] Create HTML structure following pattern
- [ ] Implement JavaScript game file
- [ ] Add script reference to App.razor
- [ ] Add C# integration methods
- [ ] Add tab switching logic
- [ ] Test game completion flow
- [ ] Add debug/reset functionality

## Common Patterns

### Canvas Games
- Use 1-bit rendering with ImageData
- 200x200 resolution scaled to 640x480
- Monospace fonts for HUD text
- Green/white color scheme

### Progress Tracking
- Visual progress bars for hold-to-complete mechanics
- Overlay messages for completion
- 2-second delay before tab transition

### Data Integration
- Use currentObject data for game parameters
- Match game difficulty to object properties
- Ensure solvable puzzles through validation