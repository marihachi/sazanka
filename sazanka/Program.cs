using DxLibDLL;

namespace sazanka
{
    class Program
    {
        public static int Main()
        {
            DX.ChangeWindowMode(1);
            DX.SetGraphMode(800, 600, 32);
            DX.SetMainWindowText("sazanka");

            if (DX.DxLib_Init() == -1) return -1;

            DX.SetDrawScreen(DX.DX_SCREEN_BACK);

            while (true)
            {
                if (DX.ProcessMessage() != 0) break;
                DX.ClearDrawScreen();
                DX.GetMousePoint(out int x, out int y);
                DX.DrawString(0, 0, $"{x}, {y}", DX.GetColor(255, 255, 255));
                DX.ScreenFlip();
            }

            DX.DxLib_End();

            return 0;
        }
    }
}
