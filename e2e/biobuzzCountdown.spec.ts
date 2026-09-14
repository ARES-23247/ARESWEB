import { expect,test } from "./fixtures";
import { mkdir } from "node:fs/promises";

test("BIOBUZZ counts down every timer mode and pauses combined play for transition",async({page},testInfo)=>{
  test.setTimeout(85000);
  await page.route("**/api/announcements",route=>route.fulfill({json:{announcement:{
    message:"No Practice tonight. Building field for tomorrow and students can't sign the NDA. Launch tomorrow at SPARK. Arrive at 9:30 AM",
    severity:"important",link:null,linkLabel:null,revision:"biobuzz-countdown-test",startsAt:null,endsAt:null,
  }}}));
  await page.goto("/biobuzz/simulator");
  const mode=page.getByRole("combobox",{name:"Timer mode",exact:true});
  const timer=page.getByRole("timer",{name:"Match timer"});
  const value=page.getByTestId("match-time");
  const restart=page.getByRole("button",{name:"Restart timed match",exact:true});
  await expect(mode).toHaveValue("teleop");
  await expect(timer).toContainText("TELEOP");
  await restart.click();
  await expect(value).toHaveText("2:00");
  await expect(value).toHaveText("1:59");
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  await expect(timer).toContainText("PAUSED");
  // Allow the last worker snapshot to arrive, then verify a whole clock second.
  await expect.poll(async()=>{const before=await value.innerText();await page.waitForTimeout(150);return before===await value.innerText();}).toBe(true);
  const frozen=await value.innerText();
  await page.waitForTimeout(1200);
  await expect(value).toHaveText(frozen);
  await page.getByRole("button",{name:"Resume",exact:true}).click();
  await expect(value).not.toHaveText(frozen);
  await mode.selectOption("auto");await restart.click();
  await expect(value).toHaveText("0:30");
  await expect(value).toHaveText("0:29");
  await expect(page.getByTestId("nectar-countdown")).toContainText("stays locked throughout AUTO");
  await mode.selectOption("combined");await restart.click();
  await expect(value).toHaveText("2:30");
  await expect(value).toHaveText("2:29");
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  await timer.scrollIntoViewIfNeeded();
  await testInfo.attach("combined-countdown",{body:await page.screenshot(),contentType:"image/png"});
  await page.getByRole("button",{name:"Resume",exact:true}).click();
  await expect(timer).toContainText("TRANSITION",{timeout:35000});
  await expect(value).toHaveText("2:00");
  await expect(timer).toContainText("match paused");
  const canvas=page.locator("canvas.bio-field"),viewport=page.viewportSize()!;
  // A large announcement plus the clock cannot share a short phone viewport
  // with the field. Scrolling must reveal the whole square below fixed navigation.
  if(viewport.height<800)await canvas.evaluate(e=>e.scrollIntoView({block:"start"}));
  else await page.evaluate(()=>window.scrollTo(0,0));
  const field=(await canvas.boundingBox())!,nav=(await page.getByRole("navigation",{name:"Main Navigation"}).boundingBox())!;
  expect(field.y).toBeGreaterThanOrEqual(nav.y+nav.height);
  expect(field.y+field.height).toBeLessThanOrEqual(viewport.height);
  await mkdir("scratch/biobuzz",{recursive:true});
  await page.screenshot({path:`scratch/biobuzz/countdown-transition-${testInfo.project.name}.png`});
  await page.waitForTimeout(1200);await expect(value).toHaveText("2:00");
  await expect(timer).toContainText("TELEOP",{timeout:12000});
  await expect(value).toHaveText("1:59");
  await page.getByRole("button",{name:"Return to untimed practice",exact:true}).click();
  await expect(value).toHaveText("UNTIMED");
  await page.waitForTimeout(1200);await expect(value).toHaveText("UNTIMED");
});
