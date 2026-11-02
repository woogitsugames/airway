// [task-23] Task-07/12/13 may inject a real game port without changing tutorial UI.
import { TutorialController, browserTutorialStorage, type TutorialPort } from './controller';
import { DemoTutorialPort } from './demo-adapter';
import { mountTutorialUi } from '../../ui/tutorial';

export function mountTutorial(host: HTMLElement, port: TutorialPort = new DemoTutorialPort()): {
  controller: TutorialController;
  dispose(): void;
} {
  const controller = new TutorialController(port, browserTutorialStorage());
  const view = mountTutorialUi(host, controller);
  return {
    controller,
    dispose(): void { view.dispose(); controller.dispose(); },
  };
}
