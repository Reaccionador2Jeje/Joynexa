using System.Diagnostics;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Joynexa.Console.Host;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new ConsoleForm());
    }
}

internal sealed class ConsoleForm : Form
{
    private readonly WebView2 _web = new() { Dock = DockStyle.Fill };
    private readonly string _dataDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AtDev", "Joynexa", "Console");
    private readonly string _libraryFile;
    private List<GameEntry> _games = [];

    public ConsoleForm()
    {
        Text = "Joynexa Console";
        MinimumSize = new Size(900, 600);
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;
        BackColor = Color.FromArgb(9, 13, 24);
        Controls.Add(_web);
        _libraryFile = Path.Combine(_dataDirectory, "games.json");
        Directory.CreateDirectory(_dataDirectory);
        LoadLibrary();
        Shown += async (_, _) => await InitializeWebViewAsync();
    }

    private void LoadLibrary()
    {
        try
        {
            if (File.Exists(_libraryFile))
                _games = JsonSerializer.Deserialize<List<GameEntry>>(File.ReadAllText(_libraryFile)) ?? [];
        }
        catch (JsonException) { _games = []; }
        catch (IOException) { _games = []; }
    }

    private void SaveLibrary()
    {
        var json = JsonSerializer.Serialize(_games, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(_libraryFile, json);
    }

    private async Task InitializeWebViewAsync()
    {
        try
        {
            await _web.EnsureCoreWebView2Async();
            _web.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _web.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _web.CoreWebView2.WebMessageReceived += OnWebMessage;
            var page = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "wwwroot", "index.html"));
            if (!File.Exists(page))
            {
                MessageBox.Show(this, "The Joynexa Console interface files are missing.", "Joynexa Console",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
                return;
            }
            _web.Source = new Uri(page);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"WebView2 could not start. Install the Microsoft Edge WebView2 Runtime.\n\n{ex.Message}",
                "Joynexa Console", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private async void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var message = JsonDocument.Parse(e.WebMessageAsJson);
            var root = message.RootElement;
            if (!root.TryGetProperty("type", out var typeElement)) return;
            switch (typeElement.GetString())
            {
                case "get-library":
                    await PostAsync(new { type = "library", games = _games.Select(g => new { id = g.Id, name = g.Name }) });
                    break;
                case "pick-game":
                    PickGame();
                    break;
                case "launch-game":
                    if (root.TryGetProperty("id", out var idElement))
                        LaunchGame(idElement.GetString() ?? "");
                    break;
                case "exit-console":
                    Close();
                    break;
            }
        }
        catch (JsonException) { await PostAsync(new { type = "host-error", message = "Invalid request." }); }
    }

    private void PickGame()
    {
        using var dialog = new OpenFileDialog
        {
            Title = "Choose a game executable",
            Filter = "Windows applications (*.exe)|*.exe",
            CheckFileExists = true,
            Multiselect = false
        };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;

        var fullPath = Path.GetFullPath(dialog.FileName);
        if (!File.Exists(fullPath) || !string.Equals(Path.GetExtension(fullPath), ".exe", StringComparison.OrdinalIgnoreCase))
        {
            _ = PostAsync(new { type = "host-error", message = "Choose an existing Windows .exe file." });
            return;
        }

        var name = Path.GetFileNameWithoutExtension(fullPath);
        var existing = _games.FirstOrDefault(g => string.Equals(g.ExecutablePath, fullPath, StringComparison.OrdinalIgnoreCase));
        if (existing is null)
        {
            existing = new GameEntry { Id = Guid.NewGuid().ToString("N"), Name = name, ExecutablePath = fullPath };
            _games.Add(existing);
            SaveLibrary();
        }
        _ = PostAsync(new { type = "library", games = _games.Select(g => new { id = g.Id, name = g.Name }) });
    }

    private void LaunchGame(string id)
    {
        var game = _games.FirstOrDefault(g => g.Id == id);
        if (game is null || !File.Exists(game.ExecutablePath))
        {
            _ = PostAsync(new { type = "host-error", message = "The selected game could not be found. Add it again." });
            return;
        }

        try
        {
            var start = new ProcessStartInfo
            {
                FileName = game.ExecutablePath,
                WorkingDirectory = Path.GetDirectoryName(game.ExecutablePath)!,
                UseShellExecute = false
            };
            Process.Start(start);
            WindowState = FormWindowState.Minimized;
        }
        catch (Exception ex)
        {
            _ = PostAsync(new { type = "host-error", message = $"Could not launch the game: {ex.Message}" });
        }
    }

    private Task PostAsync<T>(T value)
    {
        var json = JsonSerializer.Serialize(value);
        return _web.CoreWebView2.ExecuteScriptAsync($"window.joynexaHostMessage({JsonSerializer.Serialize(json)});");
    }
}

internal sealed class GameEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "";
    public string ExecutablePath { get; set; } = "";
}