using DxLibDLL;
using sazanka.Core;
using System;
using System.Collections.Generic;

namespace sazanka.App
{
    internal class MainScene : IScene
    {
        private GridPanel _gridPanel;
        public void Activated()
        {
            _gridPanel = new GridPanel(new Point(100, 100), new Size(10, 10), new Size(30, 30));
        }

        public void Update()
        {
            DX.GetMousePoint(out int x, out int y);
            DX.DrawString(0, 0, $"{x}, {y}", DX.GetColor(255, 255, 255));

            _gridPanel.Update();
        }
    }
}
