namespace SpaceGame2.Services
{
    public class GlobalVariables
    {
        public string CurrentObjectId { get; set; } = "";
        public int PlayerX { get; set; } = 0;
        public int PlayerY { get; set; } = 0;
        public bool GameStarted { get; set; } = false;
        public int Score { get; set; } = 0;
        public List<string> CompletedInvestigations { get; set; } = new();
        public string StoryProgress { get; set; } = "start";
        public string GameState { get; set; } = "menu";
        public int ObjectsInvestigated { get; set; } = 0;
        public bool DevMode { get; set; } = false;
        
        private Timer? _timer;
        public event Action? OnTimeChanged;
        
        public GlobalVariables()
        {
            _timer = new Timer(UpdateTime, null, 0, 1000);
        }
        
        private void UpdateTime(object? state)
        {
            OnTimeChanged?.Invoke();
        }
        
        public string GetCurrentDateTime()
        {
            var now = DateTime.Now;
            return $"4026.{now:MM.dd HH:mm:ss}";
        }
        
        public void UpdateGameState()
        {
            if (!GameStarted)
            {
                GameState = "menu";
            }
            else if (CompletedInvestigations.Count == 0)
            {
                GameState = "searching";
            }
            else if (CompletedInvestigations.Count < 3)
            {
                GameState = "investigating";
            }
            else
            {
                GameState = "complete";
            }
        }
    }
}