// First-run training flight (task 23). The UI is a vignette screen opened by the router.
import { TutorialController, browserTutorialStorage, type TutorialPort } from './controller';
import { VignetteTutorialPort } from './vignette-port';
import { mountTutorialUi } from '../../ui/tutorial';

export function mountTutorial(host: HTMLElement, port: TutorialPort = new VignetteTutorialPort()): {
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
