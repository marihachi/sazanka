using DxLibDLL;
using sazanka.App;
using sazanka.Core;
using System;
using System.Collections.Generic;

namespace sazanka
{
    class Program
    {
        public static int Main()
        {
            DX.ChangeWindowMode(1);
            DX.SetGraphMode(800, 600, 32);
            DX.SetMainWindowText("sazanka");

            var sceneManager = new SceneManager(new Dictionary<string, IScene>
            {
                { "MainScene", new MainScene() },
            });

            if (DX.DxLib_Init() != 0)
                return -1;

            DX.SetDrawScreen(DX.DX_SCREEN_BACK);

            try
            {
                sceneManager.ChangeScene("MainScene");

                while (true)
                {
                    if (DX.ProcessMessage() != 0)
                        break;

                    DX.ClearDrawScreen();

                    sceneManager.DispatchUpdate();

                    DX.ScreenFlip();
                }

                // dispose resources
                DX.DxLib_End();
            }
            catch (Exception ex)
            {
                DX.LogFileAdd($"(例外) {ex.Message}\r\n");

                var lines = ex.StackTrace.Split(new[] { "\r\n" }, StringSplitOptions.None);
                foreach (var line in lines)
                {
                    DX.LogFileAdd($"{line}\r\n");
                }

                // dispose resources
                DX.DxLib_End();

                return -1;
            }

            return 0;
        }
    }
}
