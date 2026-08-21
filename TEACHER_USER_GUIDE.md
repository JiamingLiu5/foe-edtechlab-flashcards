# Flashcards teacher user guide

This guide explains how to create quiz content, set up a classroom, send quizzes to students, and review their scores.

## The teacher workflow

1. Create and approve a teacher account.
2. Build a quiz deck from your teaching material.
3. Check the cards and mark the cards that should be used in quizzes.
4. Create a classroom and share its join code.
5. Configure and preview a quiz.
6. Send the quiz to the classroom.
7. View student submissions and scores.

## Before you start

- Use your institutional email address. The application currently accepts Imperial email addresses.
- A new account must be approved by an administrator before you can sign in.
- Prepare the lecture notes, slides, webpage, or question set that you want to turn into quiz cards.
- Students need their own approved student accounts. They join your classroom with a join code; they do not need access to your quiz deck.

## 1. Create a teacher account and sign in

On the sign-in page, select **Need an account? Create one**. Enter your institutional email address, choose **Teacher**, and set a password of at least eight characters.

After registration, wait for an administrator to approve the account. Once approved, sign in. Teacher accounts open on **Your classrooms** and show **Classrooms** and **Quiz decks** in the top bar.

## 2. Create a quiz deck

Select **Quiz decks** in the top bar. Enter a clear name, such as `Year 10 Biology: Cell structure`, and select **Create deck**.

A deck is your reusable question bank. Use a separate deck for each module, topic, or assessment area so that quizzes remain focused and easy to maintain.

Open the deck and select **Add cards**. You can create cards in any of these ways:

- **Create a card**: write the question and answer yourself.
- **Paste cards**: paste notes or other teaching material for AI-assisted draft generation.
- **From PDF**: upload lecture slides or another PDF.
- **From link**: provide a public webpage URL.

AI-generated cards are drafts. Review each draft and select **Accept**, **Edit**, or **Discard** before it becomes part of the deck. Do not rely on an AI draft without checking it against your source material.

## 3. Prepare cards for quizzes

Open the deck and check the question bank before sending an assignment.

- Select **Edit card** to correct a question, answer, or tags.
- Set each card’s difficulty to **Easy**, **Medium**, or **Hard**. Difficulty can be used when selecting questions for a quiz.
- When a card is accepted or edited, choose **Yes, use in quizzes** if it should be available for classroom assignments. Choose **No, not now** to keep it out of quizzes.
- Use the search box and tag/difficulty filter to check a specific part of the deck.
- Use **AI review** to ask the system to identify possible factual or clarity issues in existing cards. Review and accept any suggested changes yourself.

For a deck-based multiple-choice quiz, make sure at least four cards are marked for quizzes. The system uses the correct answer and AI-generated distractors to create the answer options.

## 4. Create a classroom

From **Your classrooms**, enter a name such as `Year 10 Biology` and select **Create classroom**.

Open the classroom to see its join code. The code is also shown on the classroom card in the classroom list.

Share the code with the students who should join. Share it through your normal private course channel rather than publishing it publicly.

Students join by opening **Classwork**, entering the code under **Join a classroom**, and selecting **Join classroom**. The classroom page shows the students who have joined.

## 5. Send a quiz

Open a classroom and find the **Send a quiz** panel.

### Choose the question source

Select a quiz deck from the **Deck** list. The list contains the decks owned by your teacher account. The selected deck supplies the cards and answers; students only see the questions and options included in the assignment.

Enter an optional **Quiz title**. If you leave it blank, the quiz uses the deck name followed by “quiz”.

### Choose the format

- **Multiple choice**: students select one answer, or select all correct answers when a question has more than one correct answer.
- **Fill in the blank**: students type an answer. The response is graded by AI against the reference answer.
- **Mixed**: combines multiple-choice and fill-in-the-blank questions.

For multiple-choice quizzes, choose one of the following sources:

- **Deck cards with AI distractors**: select questions from the deck and have the system create wrong answer options.
- **Write MCQs with AI options**: write the question and one or more correct answers yourself. The system generates three wrong options for each question.

When writing a manual MCQ, enter every accepted correct answer on a separate line. Check the generated options carefully during the preview.

### Configure the quiz

For deck-based quizzes, set:

- **Questions**: the total number of questions, from 1 to 100.
- **Difficulty**: include cards of any difficulty or select Easy, Medium, or Hard.
- **Hard questions**: reserve a number of hard questions within the total question count.
- **Timer**: enter the number of minutes, or leave it at `0` for no timer.

Leave **Show question preview before students start** selected if you want students to see the question set before they begin. If a timer is enabled, it starts when the student starts the quiz after the preview. With preview disabled, the quiz starts as soon as the student opens it.

Select **Preview quiz** or **Generate answer options**. If a preview is shown, check the wording, question type, answer options, and point value for every question. Change the points if some questions should carry more or less weight.

Select **Send to classroom** when the quiz is ready. The assignment then appears in the classroom’s **Sent quizzes** list and in the students’ **Classwork** pages.

## 6. What students see

Students open **Classwork**, select **Take quiz**, and see the classroom name and quiz title. If preview is enabled, they can review the question formats and options before selecting **Start quiz**.

During the quiz:

- They move through one question at a time with **Previous** and **Next**.
- Multiple-choice questions show the available options.
- Fill-in-the-blank questions provide a text box.
- Correctness is not revealed while they are answering.
- A timer counts down when one has been configured.

Students select **Submit quiz** after answering the final question. Each student can submit a particular assignment once. After submission, they can see their score from **Classwork**.

## 7. View scores

On the classroom page, find the quiz in **Sent quizzes** and select **View scores**.

The scores table shows:

- the student name or email address;
- the score achieved;
- the total available points; and
- the submission date and time.

If no student has submitted the quiz, the scores panel reports that there are no submissions yet. Refresh or reopen the classroom page to load the latest classroom and quiz information.

## Recommended teaching practice

- Check every AI-generated card and distractor against the course material before assigning it.
- Keep questions focused on one idea and answers concise enough to mark reliably.
- Use difficulty labels consistently so the Hard question setting produces a useful balance.
- Preview every quiz, especially quizzes using AI-generated answer options.
- Start with a short, low-stakes quiz to confirm that students can join the classroom and that the questions display correctly.
- Tell students whether a quiz is timed and whether they should select all correct answers for multi-answer questions.
- Keep the classroom join code private and share it only with the intended class.

## Troubleshooting

**I cannot sign in after registering.** Your teacher account may still be awaiting administrator approval.

**A deck does not appear in the quiz setup.** Make sure you are signed in with the teacher account that owns the deck, then reload the classroom page.

**The quiz cannot generate enough questions.** Increase the number of cards marked **Yes, use in quizzes**, or reduce the requested question count and difficulty restrictions. A deck-based multiple-choice quiz needs at least four quiz-eligible cards.

**AI cannot create answer options.** Check that each manual MCQ has a question and at least one correct answer, then try again. For deck-based MCQs, check that the deck contains enough distinct quiz-eligible answers.

**A student cannot find the quiz.** Confirm that the student joined the correct classroom using the exact join code and that the quiz was sent to that classroom.

**A student has already submitted.** An assignment currently accepts one submission per student. The submitted score remains available from **Classwork**.

For the student-facing instructions, see [`USER_GUIDE.md`](./USER_GUIDE.md).
