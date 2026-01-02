using SpaceGame2.Components;
using Microsoft.AspNetCore.Http.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddHttpClient();
builder.Services.AddScoped(sp => 
{
    var httpContext = sp.GetService<IHttpContextAccessor>()?.HttpContext;
    var baseUri = httpContext?.Request.GetDisplayUrl() ?? "https://localhost:5001/";
    var uri = new Uri(baseUri).GetLeftPart(UriPartial.Authority);
    return new HttpClient { BaseAddress = new Uri(uri) };
});
builder.Services.AddHttpContextAccessor();

builder.Services.AddSingleton<SpaceGame2.Services.GlobalVariables>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();


app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
