using DxLibDLL;
using sazanka.Core;
using System;
using System.Collections.Generic;
using System.Drawing;

namespace sazanka.App
{
    internal class MainScene : IScene
    {
        private GridPanel _gridPanel;
        public void Activated()
        {
            _gridPanel = new GridPanel(new Point(50, 50), new Size(10, 10), new Size(30, 30));
        }

        public void Update()
        {
            // mouse input
            int button = DX.GetMouseInput();
            int wheel = DX.GetMouseWheelRotVol();
            DX.GetMousePoint(out int x, out int y);
            var pos = new Point(x, y);

            // test
            if (wheel != 0)
            {
                _gridPanel.ScreenOrigin += new Size(0, wheel * 10);
            }

            _gridPanel.Update();

            DX.DrawString(0, 0, $"X={pos.X} Y={pos.Y} {button & 1} {button & 2} {_gridPanel.ScreenOrigin.X} {_gridPanel.ScreenOrigin.Y}", DX.GetColor(255, 255, 255));
        }
    }
}
