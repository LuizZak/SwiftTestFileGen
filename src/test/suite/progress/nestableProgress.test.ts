/* eslint-disable @typescript-eslint/naming-convention */
import path = require('path');
import { describe, it, beforeEach } from 'mocha';
import { NestableProgress, NestableProgressReportStyle } from '../../../progress/nestableProgress';
import { MockProgress } from '../testMocks/vscodeProgress';

suite("nestableProgress Test Suite", () => {
    describe('NestableProgress', () => {
        let mockProgress: MockProgress<{ message?: string; increment?: number }>;

        function makeSut(message?: string, totalUnitCount?: number): NestableProgress {
            return new NestableProgress(mockProgress, message, totalUnitCount);
        }

        beforeEach(() => {
            mockProgress = new MockProgress();
        });

        describe('reportMessage', () => {
            it('should update progress with messages', () => {
                const sut = makeSut();

                sut.reportMessage("A message");
                sut.reportMessage("Another message");

                mockProgress.assertWasReported({
                    message: "A message",
                });
                mockProgress.assertWasReported({
                    message: "Another message",
                });
            });

            it('should join messages on nested progresses', () => {
                const sut = makeSut("Root");

                sut.createChild(1, undefined, "Child message");

                mockProgress.assertWasReported({
                    message: "Root - Child message",
                });
            });

            it('should automatically strip ellipsis from intermediate progress messages', () => {
                const sut = makeSut("Root");

                const child1 = sut.createChild(1, undefined, "Child message...");
                child1.createChild(1, undefined, "Grandchild message...");

                mockProgress.assertWasReported({
                    message: "Root - Child message...",
                });
                mockProgress.assertWasReported({
                    message: "Root - Child message - Grandchild message...",
                });
                mockProgress.assertWasNotReported({
                    message: "Root - Child message... - Grandchild message...",
                });
            });

            it('must be ignored if progress object is completed', () => {
                const sut = makeSut();
                sut.complete();

                sut.reportMessage("A message");

                mockProgress.assertWasNotReported({
                    message: "A message",
                });
            });
        });

        describe('increment', () => {
            it('should increment by 1 by default', () => {
                const sut = makeSut(undefined, 100);

                sut.increment();

                mockProgress.assertWasReported({
                    increment: 1,
                });
            });

            it('should proportionally increment parent progress value', () => {
                const sut = makeSut(undefined, 100);
                const child = sut.createChild(10, 15);

                child.increment(5);

                mockProgress.assertWasReported({
                    increment: 7.5,
                });
            });

            it('must be ignored if progress object is completed', () => {
                const sut = makeSut(undefined, 100);
                sut.complete();

                sut.increment(1);

                mockProgress.assertWasNotReported({
                    increment: 1,
                });
            });
        });

        describe('complete', () => {
            it('should increment the progress object by any remaining unit count prior to completing', () => {
                const sut = makeSut(undefined, 100);
                sut.increment(20);

                sut.complete();

                mockProgress.assertWasReported({
                    increment: 80,
                });
            });

            it("should proportionally increment parent progress value based on child's total unit count", () => {
                const sut = makeSut(undefined, 100);
                const child = sut.createChild(10, 15);

                child.complete();

                mockProgress.assertWasReported({
                    increment: 15,
                });
            });
        });

        describe('showProgressInMessageStyle', () => {
            describe('none', () => {
                it('should do nothing if message is empty', () => {
                    const sut = makeSut(undefined, 100);
                    sut.showProgressInMessageStyle = NestableProgressReportStyle.none;

                    mockProgress.assertAllReportsMatch({
                        message: "",
                    });
                });
            });

            describe('asPercentage', () => {
                it('should do nothing if message is empty', () => {
                    const sut = makeSut(undefined, 100);
                    sut.showProgressInMessageStyle = NestableProgressReportStyle.asPercentage;

                    mockProgress.assertAllReportsMatch({
                        message: "",
                    });
                });

                it('should update progress message immediately when set', () => {
                    const sut = makeSut("Progress", 100);
                    
                    sut.showProgressInMessageStyle = NestableProgressReportStyle.asPercentage;

                    mockProgress.assertWasReported({
                        message: "Progress [0%]",
                    });
                });

                it('should place progress before ellipsis, if present', () => {
                    const sut = makeSut("Progress...", 100);
                    
                    sut.showProgressInMessageStyle = NestableProgressReportStyle.asPercentage;

                    mockProgress.assertWasReported({
                        message: "Progress [0%]...",
                    });
                });

                it('should automatically update the message as progress increments', () => {
                    const sut = makeSut("Progress", 100);
                    sut.showProgressInMessageStyle = NestableProgressReportStyle.asPercentage;

                    sut.increment();
                    sut.increment(2);

                    mockProgress.assertWasReported({
                        message: "Progress [0%]",
                    });
                    mockProgress.assertWasReported({
                        message: "Progress [1%]",
                    });
                    mockProgress.assertWasReported({
                        message: "Progress [3%]",
                    });
                });

                it('should use totalUnitCount as the 100% mark', () => {
                    const sut = makeSut("Progress", 500);
                    sut.showProgressInMessageStyle = NestableProgressReportStyle.asPercentage;

                    sut.increment();
                    sut.increment(25);
                    sut.increment(225);

                    mockProgress.assertWasReported({
                        message: "Progress [0%]",
                    });
                    mockProgress.assertWasReported({
                        message: "Progress [5%]",
                    });
                    mockProgress.assertWasReported({
                        message: "Progress [50%]",
                    });
                });
            });

            describe('asUnits', () => {
                it('should do nothing if message is empty', () => {
                    const sut = makeSut(undefined, 100);
                    sut.showProgressInMessageStyle = NestableProgressReportStyle.asUnits;

                    mockProgress.assertAllReportsMatch({
                        message: "",
                    });
                });

                it('should update progress message immediately when set', () => {
                    const sut = makeSut("Progress", 100);
                    
                    sut.showProgressInMessageStyle = NestableProgressReportStyle.asUnits;

                    mockProgress.assertWasReported({
                        message: "Progress [0/100]",
                    });
                });

                it('should automatically update the message as progress increments', () => {
                    const sut = makeSut("Progress", 100);
                    sut.showProgressInMessageStyle = NestableProgressReportStyle.asUnits;

                    sut.increment();
                    sut.increment(2);

                    mockProgress.assertWasReported({
                        message: "Progress [0/100]",
                    });
                    mockProgress.assertWasReported({
                        message: "Progress [1/100]",
                    });
                    mockProgress.assertWasReported({
                        message: "Progress [3/100]",
                    });
                });
            });

            it('should not overwrite nested progress status when updating parent progress statuses', () => {
                const sut = makeSut("Progress", 100);
                const child = sut.createChild(50, 50, "Child...");
                sut.showProgressInMessageStyle = NestableProgressReportStyle.asPercentage;
                child.showProgressInMessageStyle = NestableProgressReportStyle.asPercentage;

                child.increment(10);

                mockProgress.assertWasReported({
                    message: "Progress [0%] - Child [0%]...",
                });
                mockProgress.assertLastReported({
                    message: "Progress [10%] - Child [20%]...",
                });
            });
        });
    });
});