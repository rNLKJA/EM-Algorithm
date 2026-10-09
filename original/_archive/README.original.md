# Statistics but you're missing data (The EM Algorithm)

## The Netflix Problem: When Your Data Goes Missing

Imagine you're a data scientist at Netflix in 2010. You're tasked with building a recommendation system that can predict what movies users will love. You have millions of users and thousands of movies, but here's the catch: **most users have only rated a tiny fraction of the available movies**.

Your data looks like this:
- User A rated: "The Matrix" (5 stars), "Inception" (4 stars), "Avatar" (3 stars)
- User B rated: "The Matrix" (4 stars), "Titanic" (5 stars)  
- User C rated: "Inception" (5 stars), "Avatar" (4 stars), "Titanic" (2 stars)
- ...and millions more users with similarly sparse ratings

**The Challenge**: How do you find patterns in this incomplete data? Traditional statistical methods assume you have complete information, but here 99% of your data is missing! You can't just ignore the missing ratings—that would throw away valuable information. But you also can't fill them in randomly—that would corrupt your analysis.

**The EM Algorithm Solution**: This is exactly where the EM Algorithm shines. It's like having a brilliant detective who can:
1. **Look at the partial evidence** (the ratings you do have)
2. **Make educated guesses** about the missing pieces (what users would rate movies they haven't seen)
3. **Refine those guesses** based on patterns in the complete picture
4. **Repeat until the picture becomes clear**

The algorithm doesn't just fill in missing data randomly—it learns the underlying patterns (like "users who like sci-fi tend to rate action movies highly") and uses those patterns to make intelligent predictions about the missing values.

## Why This Matters Beyond Netflix

This same problem appears everywhere:
- **Medical Research**: Patients drop out of studies, leaving incomplete health records
- **Market Research**: Survey respondents skip questions, creating gaps in consumer data  
- **Genetics**: DNA sequencing sometimes fails, leaving missing genetic markers
- **Finance**: Stock prices have gaps during market closures and holidays

The EM Algorithm is the statistical Swiss Army knife that turns incomplete, messy data into actionable insights.

---

## Purpose: Estimating Missing Values from Partial Observations

**The Core Goal**: The EM Algorithm's primary purpose is to estimate missing or unobserved values by learning from the patterns in our partial observations. Think of it as a sophisticated "fill-in-the-blanks" technique that doesn't just guess randomly, but learns the underlying structure of your data to make intelligent predictions.

**What We're Really Doing**:
- **Input**: Partial observations (like sparse movie ratings, incomplete survey responses, or missing genetic markers)
- **Process**: Learn the hidden patterns and relationships in the data
- **Output**: Estimates for the missing values that are consistent with the observed patterns

**Why This Matters**: In real-world data, missing values aren't random—they often follow patterns. The EM algorithm exploits these patterns to make principled estimates rather than naive guesses.

---

The Expectation-Maximization (EM) algorithm is a powerful iterative method for finding maximum likelihood estimates when dealing with incomplete data or latent variables. This document provides a comprehensive mathematical treatment of the EM algorithm using the normal distribution as our primary example.

> Probability distributions describe what data values are likely and unlikely 

## Overview: The EM Algorithm in Simple Terms

The EM algorithm is like a smart detective that solves a mystery step by step:

**The Mystery**: You have data from two groups, but you don't know which data point belongs to which group!

**The Solution**: The EM algorithm has two simple steps that it repeats:
1. **E-step (Expectation)**: "Given what I know so far, which group does each data point probably belong to?"
2. **M-step (Maximization)**: "Now that I have better guesses about the groups, let me update what each group looks like"

**The Magic**: Each time it repeats these steps, it gets better and better until it figures out the answer!

## A Complete Example: Let's Do This Step by Step

Let's say we have 4 movie ratings: [2, 3, 7, 8]. We think there are two groups of users:
- **Group 1**: Users who rate movies low (maybe they're picky)
- **Group 2**: Users who rate movies high (maybe they're easy to please)

But we don't know which rating belongs to which group!

### Initial Guess (Iteration 0)

Let's start with a wild guess:
- **Group 1**: Average rating = 2.5, Standard deviation = 0.5, Mixing proportion = 50%
- **Group 2**: Average rating = 7.5, Standard deviation = 0.5, Mixing proportion = 50%

### Iteration 1: E-step and M-step

#### E-step: "Which group does each rating probably belong to?"

For each rating, we calculate the probability it belongs to each group:

**Rating 2:**
- Probability from Group 1: 0.5 × normal_pdf(2, 2.5, 0.5) = 0.5 × 0.8 = 0.4
- Probability from Group 2: 0.5 × normal_pdf(2, 7.5, 0.5) = 0.5 × 0.0001 = 0.00005
- **Total probability**: 0.4 + 0.00005 = 0.40005
- **P(Group 1 | rating=2)**: 0.4/0.40005 = 0.9999 (99.99% chance it's Group 1)
- **P(Group 2 | rating=2)**: 0.00005/0.40005 = 0.0001 (0.01% chance it's Group 2)

**Rating 3:**
- Probability from Group 1: 0.5 × normal_pdf(3, 2.5, 0.5) = 0.5 × 0.6 = 0.3
- Probability from Group 2: 0.5 × normal_pdf(3, 7.5, 0.5) = 0.5 × 0.0001 = 0.00005
- **Total probability**: 0.3 + 0.00005 = 0.30005
- **P(Group 1 | rating=3)**: 0.3/0.30005 = 0.9998 (99.98% chance it's Group 1)
- **P(Group 2 | rating=3)**: 0.00005/0.30005 = 0.0002 (0.02% chance it's Group 2)

**Rating 7:**
- Probability from Group 1: 0.5 × normal_pdf(7, 2.5, 0.5) = 0.5 × 0.0001 = 0.00005
- Probability from Group 2: 0.5 × normal_pdf(7, 7.5, 0.5) = 0.5 × 0.8 = 0.4
- **Total probability**: 0.00005 + 0.4 = 0.40005
- **P(Group 1 | rating=7)**: 0.00005/0.40005 = 0.0001 (0.01% chance it's Group 1)
- **P(Group 2 | rating=7)**: 0.4/0.40005 = 0.9999 (99.99% chance it's Group 2)

**Rating 8:**
- Probability from Group 1: 0.5 × normal_pdf(8, 2.5, 0.5) = 0.5 × 0.0001 = 0.00005
- Probability from Group 2: 0.5 × normal_pdf(8, 7.5, 0.5) = 0.5 × 0.6 = 0.3
- **Total probability**: 0.00005 + 0.3 = 0.30005
- **P(Group 1 | rating=8)**: 0.00005/0.30005 = 0.0002 (0.02% chance it's Group 1)
- **P(Group 2 | rating=8)**: 0.3/0.30005 = 0.9998 (99.98% chance it's Group 2)

#### M-step: "Update what each group looks like"

Now we use these probabilities to update our group characteristics:

**New Mixing Proportions:**
- **Group 1 proportion**: (0.9999 + 0.9998 + 0.0001 + 0.0002) / 4 = 2.0000 / 4 = 0.5 (50%)
- **Group 2 proportion**: (0.0001 + 0.0002 + 0.9999 + 0.9998) / 4 = 2.0000 / 4 = 0.5 (50%)

**New Group 1 Average:**
- **Weighted average**: (0.9999×2 + 0.9998×3 + 0.0001×7 + 0.0002×8) / (0.9999 + 0.9998 + 0.0001 + 0.0002)
- **Numerator**: 1.9998 + 2.9994 + 0.0007 + 0.0016 = 5.0015
- **Denominator**: 2.0000
- **New Group 1 average**: 5.0015 / 2.0000 = 2.5

**New Group 2 Average:**
- **Weighted average**: (0.0001×2 + 0.0002×3 + 0.9999×7 + 0.9998×8) / (0.0001 + 0.0002 + 0.9999 + 0.9998)
- **Numerator**: 0.0002 + 0.0006 + 6.9993 + 7.9984 = 14.9985
- **Denominator**: 2.0000
- **New Group 2 average**: 14.9985 / 2.0000 = 7.5

**New Standard Deviations:**
- **Group 1 std**: √[(0.9999×(2-2.5)² + 0.9998×(3-2.5)² + 0.0001×(7-2.5)² + 0.0002×(8-2.5)²) / 2.0000]
- **Group 1 std**: √[(0.9999×0.25 + 0.9998×0.25 + 0.0001×20.25 + 0.0002×30.25) / 2.0000] = √[0.5 / 2.0000] = 0.5
- **Group 2 std**: √[(0.0001×(2-7.5)² + 0.0002×(3-7.5)² + 0.9999×(7-7.5)² + 0.9998×(8-7.5)²) / 2.0000]
- **Group 2 std**: √[(0.0001×30.25 + 0.0002×20.25 + 0.9999×0.25 + 0.9998×0.25) / 2.0000] = √[0.5 / 2.0000] = 0.5

### Updated Parameters After Iteration 1:
- **Group 1**: Average = 2.5, Std = 0.5, Proportion = 50%
- **Group 2**: Average = 7.5, Std = 0.5, Proportion = 50%

### Iteration 2: Let's Do It Again!

#### E-step: "Which group does each rating probably belong to?" (with updated parameters)

**Rating 2:**
- Probability from Group 1: 0.5 × normal_pdf(2, 2.5, 0.5) = 0.5 × 0.8 = 0.4
- Probability from Group 2: 0.5 × normal_pdf(2, 7.5, 0.5) = 0.5 × 0.0001 = 0.00005
- **P(Group 1 | rating=2)**: 0.4/0.40005 = 0.9999 (99.99% chance it's Group 1)
- **P(Group 2 | rating=2)**: 0.00005/0.40005 = 0.0001 (0.01% chance it's Group 2)

*(The calculations are the same because our parameters didn't change much)*

#### M-step: "Update what each group looks like" (again)

The parameters will stay very similar because our algorithm is already working well!

### What Just Happened?

1. **We started with a wild guess** about what the two groups looked like
2. **We calculated probabilities** for each data point belonging to each group
3. **We updated our group descriptions** based on these probabilities
4. **We repeated this process** until the groups became clear

**The Result**: We successfully identified that ratings [2, 3] belong to Group 1 (low raters) and ratings [7, 8] belong to Group 2 (high raters)!

### Why This Works

- **E-step**: Uses Bayes' theorem to calculate "given this rating, which group is it most likely from?"
- **M-step**: Updates group characteristics based on "if these ratings belong to this group, what should the group look like?"
- **Convergence**: Each iteration makes the groups clearer and clearer until we have the answer

## The Math Behind It (Simplified)

### What is Likelihood?

**In Simple Terms**: Likelihood tells us "how likely is it that our data came from this particular group?"

**Example**: If we have a rating of 2, and Group 1 has an average of 2.5, then it's very likely that rating 2 came from Group 1. But if Group 2 has an average of 7.5, then it's very unlikely that rating 2 came from Group 2.

### The Normal Distribution Formula

For a normal distribution with mean $\mu$ and standard deviation $\sigma$, the probability density function is:

$$f(x) = \frac{1}{\sqrt{2\pi\sigma^2}} \exp\left(-\frac{(x - \mu)^2}{2\sigma^2}\right)$$

**What this means**:
- If $x$ is close to $\mu$, the probability is high
- If $x$ is far from $\mu$, the probability is low
- $\sigma$ controls how "spread out" the distribution is

### Log-Likelihood (Why We Use It)

Instead of multiplying probabilities (which can get very small), we add their logarithms:

$$\ell(\theta) = \sum_{i=1}^{n} \log f(x_i | \theta)$$

**Why this helps**:
- Adding is easier than multiplying
- We can compare different models more easily
- The EM algorithm maximizes this log-likelihood

## Expectation (E-step): "What's the Best Guess?"

### The Big Picture

The E-step asks: *"Given what I know about the patterns in my data, which group does each data point probably belong to?"*

### In Simple Terms

**What we're doing**: For each data point, we calculate the probability that it belongs to each group.

**How we do it**: We use Bayes' theorem:
- **Prior**: What we think about each group (mixing proportions)
- **Likelihood**: How likely is this data point given each group's characteristics
- **Posterior**: The final probability that this data point belongs to each group

### The Formula (Simplified)

For each data point $x_i$ and each group $k$:

$$P(\text{Group } k | x_i) = \frac{\text{Prior}_k \times \text{Likelihood}_k}{\text{Total Probability}}$$

Where:
- **Prior_k** = mixing proportion of group $k$ (e.g., 50% of users are in group 1)
- **Likelihood_k** = probability of seeing $x_i$ if it came from group $k$
- **Total Probability** = sum of (Prior × Likelihood) for all groups

### Concrete Example: Mixture of Two Normal Distributions

Let's say we're trying to separate our data into two groups (like "sci-fi lovers" vs "romance lovers" in the Netflix example), but we don't know which group each user belongs to.

**Setup**:
- Observed data: $\mathbf{X} = \{x_1, x_2, \ldots, x_n\}$ (movie ratings)
- Latent variables: $\mathbf{Z} = \{z_{ik}\}$ where $z_{ik} \in \{0, 1\}$ is an indicator variable:
  - $z_{ik} = 1$ if user $i$ belongs to group $k$
  - $z_{ik} = 0$ if user $i$ does NOT belong to group $k$
- Parameters: $\theta = \{\pi_1, \pi_2, \mu_1, \mu_2, \sigma_1^2, \sigma_2^2\}$ (mixing proportions, means, and variances for each group)

**Important**: For each user $i$, exactly one $z_{ik} = 1$ and all others $z_{ik} = 0$ (each user belongs to exactly one group).

**The Complete Log-Likelihood** (if we knew which group each user belonged to):

$$\log L(\theta; \mathbf{X}, \mathbf{Z}) = \sum_{i=1}^{n} \sum_{k=1}^{2} z_{ik} \log[\pi_k f(x_i | \mu_k, \sigma_k^2)]$$

Where:
- $\pi_k$ = proportion of users in group $k$ (e.g., 60% sci-fi lovers, 40% romance lovers)
- $f(x_i | \mu_k, \sigma_k^2)$ = normal density for group $k$ (e.g., sci-fi lovers rate action movies highly)

### The Key Calculation: Posterior Probabilities

The E-step computes the probability that each user belongs to each group. Let's derive this step by step.

#### Step 1: Understanding What We Want

We want to compute:
$$\gamma_{ik} = E[z_{ik} | x_i, \theta^{(t)}] = P(z_{ik} = 1 | x_i, \theta^{(t)})$$

**What this means**:
- $z_{ik} = 1$ means "user $i$ belongs to group $k$" (e.g., user $i$ is a sci-fi lover)
- $z_{ik} = 0$ means "user $i$ does NOT belong to group $k$" (e.g., user $i$ is NOT a sci-fi lover)
- $\gamma_{ik}$ is the probability that user $i$ belongs to group $k$, given their observed rating $x_i$ and our current parameter estimates $\theta^{(t)}$

**Note**: This is about **group membership**, not user activity. All users are "active" - we're just trying to figure out which group they belong to.

#### Step 2: Applying Bayes' Theorem

Using Bayes' theorem:
$$P(z_{ik} = 1 | x_i, \theta^{(t)}) = \frac{P(x_i | z_{ik} = 1, \theta^{(t)}) \cdot P(z_{ik} = 1 | \theta^{(t)})}{P(x_i | \theta^{(t)})}$$

Let's break this down:
- $P(x_i | z_{ik} = 1, \theta^{(t)})$ = probability of observing rating $x_i$ given that user $i$ is in group $k$
- $P(z_{ik} = 1 | \theta^{(t)})$ = prior probability that user $i$ is in group $k$
- $P(x_i | \theta^{(t)})$ = marginal probability of observing rating $x_i$ (normalizing constant)

#### Step 3: Identifying Each Component

**Component 1**: $P(x_i | z_{ik} = 1, \theta^{(t)}) = f(x_i | \mu_k^{(t)}, \sigma_k^{2(t)})$

This is simply the probability density function of the normal distribution for group $k$.

**Component 2**: $P(z_{ik} = 1 | \theta^{(t)}) = \pi_k^{(t)}$

This is the mixing proportion for group $k$ - the prior probability that any user belongs to group $k$.

**Component 3**: $P(x_i | \theta^{(t)}) = \sum_{j=1}^{2} \pi_j^{(t)} f(x_i | \mu_j^{(t)}, \sigma_j^{2(t)})$

This is the marginal likelihood - the probability of observing $x_i$ from any group, weighted by the mixing proportions.

#### Step 4: Putting It All Together

Substituting back into Bayes' theorem:

$$\gamma_{ik} = \frac{f(x_i | \mu_k^{(t)}, \sigma_k^{2(t)}) \cdot \pi_k^{(t)}}{\sum_{j=1}^{2} \pi_j^{(t)} f(x_i | \mu_j^{(t)}, \sigma_j^{2(t)})}$$

Rearranging the numerator:

$$\gamma_{ik} = \frac{\pi_k^{(t)} f(x_i | \mu_k^{(t)}, \sigma_k^{2(t)})}{\sum_{j=1}^{2} \pi_j^{(t)} f(x_i | \mu_j^{(t)}, \sigma_j^{2(t)})}$$

#### Step 5: Verification

Let's verify that this makes sense:
- The numerator is the joint probability: $P(x_i, z_{ik} = 1 | \theta^{(t)})$
- The denominator is the marginal probability: $P(x_i | \theta^{(t)})$
- The ratio gives us the conditional probability: $P(z_{ik} = 1 | x_i, \theta^{(t)})$

**Intuitive Interpretation**:
- $\gamma_{i1}$ = probability that user $i$ is a "sci-fi lover" given their rating pattern
- $\gamma_{i2}$ = probability that user $i$ is a "romance lover" given their rating pattern
- $\gamma_{i1} + \gamma_{i2} = 1$ (user must belong to one group or the other)

### Example Calculation

Suppose we have a user who rated "The Matrix" (5 stars) and "Titanic" (2 stars). Given our current estimates:
- Sci-fi group: $\mu_1 = 4.5$, $\sigma_1 = 0.8$, $\pi_1 = 0.6$
- Romance group: $\mu_2 = 3.0$, $\sigma_2 = 1.2$, $\pi_2 = 0.4$

For "The Matrix" rating of 5:
- Sci-fi probability: $0.6 \times f(5 | 4.5, 0.8^2) = 0.6 \times 0.47 = 0.28$
- Romance probability: $0.4 \times f(5 | 3.0, 1.2^2) = 0.4 \times 0.12 = 0.05$

So $\gamma_{i1} = \frac{0.28}{0.28 + 0.05} = 0.85$ (85% chance this user is a sci-fi lover)

### Why This Works

The E-step is essentially asking: *"Given this user's rating pattern, which group are they most likely to belong to?"* It uses Bayes' theorem to update our beliefs about group membership based on the evidence (observed ratings).

## Maximization (M-step): "Update Your Model"

### The Big Picture

The M-step asks: *"Now that I have better guesses about which group each data point belongs to, what should each group look like?"*

### In Simple Terms

**What we're doing**: We take the probabilities from the E-step and use them to update our group characteristics.

**How we do it**: We calculate weighted averages, where the weights are the probabilities from the E-step.

### The Three Updates

**1. Mixing Proportions** (What fraction belongs to each group?):
$$\pi_k = \frac{1}{n}\sum_{i=1}^{n} P(\text{Group } k | x_i)$$

**2. Group Means** (What's the average for each group?):
$$\mu_k = \frac{\sum_{i=1}^{n} P(\text{Group } k | x_i) \times x_i}{\sum_{i=1}^{n} P(\text{Group } k | x_i)}$$

**3. Group Standard Deviations** (How spread out is each group?):
$$\sigma_k = \sqrt{\frac{\sum_{i=1}^{n} P(\text{Group } k | x_i) \times (x_i - \mu_k)^2}{\sum_{i=1}^{n} P(\text{Group } k | x_i)}}$$

### Intuitive Understanding

Imagine you're a teacher trying to understand two different student groups:
- **E-step**: You look at each student's test scores and guess which group they belong to
- **M-step**: You then calculate the average score and variability for each group based on your guesses

The M-step does exactly this—it updates the group characteristics based on the group membership probabilities from the E-step.

### Parameter Updates for Mixture of Normals

**1. Mixing Proportions** (What fraction of users belong to each group?):
$$\pi_k^{(t+1)} = \frac{1}{n}\sum_{i=1}^{n} \gamma_{ik}$$

**Intuition**: This is just the average probability that users belong to group $k$. If $\gamma_{i1}$ averages to 0.6, then 60% of users are sci-fi lovers.

**2. Means** (What's the average rating for each group?):
$$\mu_k^{(t+1)} = \frac{\sum_{i=1}^{n} \gamma_{ik} x_i}{\sum_{i=1}^{n} \gamma_{ik}}$$

**Intuition**: This is a weighted average of all ratings, where the weights are the probabilities that each user belongs to group $k$. Users who are more likely to be in group $k$ have more influence on group $k$'s average.

**3. Variances** (How spread out are the ratings in each group?):
$$\sigma_k^{2(t+1)} = \frac{\sum_{i=1}^{n} \gamma_{ik} (x_i - \mu_k^{(t+1)})^2}{\sum_{i=1}^{n} \gamma_{ik}}$$

**Intuition**: This measures how much the ratings vary around the group mean, again weighted by group membership probabilities.

### Example: Updating Group Characteristics

Suppose after the E-step, we have:
- User A: 85% sci-fi lover, rated "The Matrix" 5 stars
- User B: 20% sci-fi lover, rated "Titanic" 4 stars  
- User C: 90% sci-fi lover, rated "Inception" 5 stars

**Updating the sci-fi group mean**:
$$\mu_{sci-fi} = \frac{0.85 \times 5 + 0.20 \times 4 + 0.90 \times 5}{0.85 + 0.20 + 0.90} = \frac{4.25 + 0.80 + 4.50}{1.95} = 4.9$$

Notice how User B's rating of 4 has less influence (weight 0.20) because they're less likely to be a sci-fi lover.

### Why This Makes Sense

The M-step ensures that:
1. **Group proportions** reflect the actual distribution of users across groups
2. **Group means** are calculated using weighted averages that give more weight to users who are more likely to belong to that group
3. **Group variances** capture the spread of ratings within each group, again properly weighted

This creates a feedback loop: better group estimates lead to better group membership estimates, which lead to even better group estimates, and so on.

## Mixed Distributions: Normal + Beta Example

What if our data comes from two completely different types of distributions? This is where the EM algorithm really shines—it can handle mixtures of any distributions, not just the same type.

### Real-World Scenario: Product Ratings

Imagine you're analyzing product ratings on an e-commerce platform where:
- **Group 1**: Tech-savvy users who rate products on a continuous scale (0-10) → **Normal Distribution**
- **Group 2**: Casual users who only give thumbs up/down ratings → **Beta Distribution** (since ratings are bounded between 0 and 1)

### Mathematical Setup

**Observed Data**: $\mathbf{X} = \{x_1, x_2, \ldots, x_n\}$ where each $x_i$ is a rating

**Latent Variables**: $\mathbf{Z} = \{z_1, z_2, \ldots, z_n\}$ where $z_i \in \{0, 1\}$ indicates which group user $i$ belongs to

**Parameters**: 
- $\theta = \{\pi_1, \pi_2, \mu, \sigma^2, \alpha, \beta\}$
- $\pi_1, \pi_2$ = mixing proportions
- $\mu, \sigma^2$ = parameters for the normal distribution (Group 1)
- $\alpha, \beta$ = parameters for the beta distribution (Group 2)

### Probability Density Functions

**Group 1 (Normal Distribution)**:
$$f_1(x_i | \mu, \sigma^2) = \frac{1}{\sqrt{2\pi\sigma^2}} \exp\left(-\frac{(x_i - \mu)^2}{2\sigma^2}\right)$$

**Group 2 (Beta Distribution)**:
$$f_2(x_i | \alpha, \beta) = \frac{x_i^{\alpha-1}(1-x_i)^{\beta-1}}{B(\alpha, \beta)}$$

Where $B(\alpha, \beta) = \frac{\Gamma(\alpha)\Gamma(\beta)}{\Gamma(\alpha+\beta)}$ is the beta function.

### E-step: Posterior Probabilities

The E-step computes the probability that each observation belongs to each group. Let's derive this step by step for the mixed distribution case.

#### Step 1: Understanding What We Want

We want to compute:
$$\gamma_{i1} = E[z_{i1} | x_i, \theta^{(t)}] = P(z_{i1} = 1 | x_i, \theta^{(t)})$$
$$\gamma_{i2} = E[z_{i2} | x_i, \theta^{(t)}] = P(z_{i2} = 1 | x_i, \theta^{(t)})$$

This is the probability that observation $i$ comes from group 1 (normal) or group 2 (beta), given the observed value $x_i$ and our current parameter estimates $\theta^{(t)}$.

#### Step 2: Applying Bayes' Theorem

Using Bayes' theorem for group 1:
$$P(z_{i1} = 1 | x_i, \theta^{(t)}) = \frac{P(x_i | z_{i1} = 1, \theta^{(t)}) \cdot P(z_{i1} = 1 | \theta^{(t)})}{P(x_i | \theta^{(t)})}$$

Let's break this down:
- $P(x_i | z_{i1} = 1, \theta^{(t)})$ = probability of observing $x_i$ given that it comes from the normal distribution
- $P(z_{i1} = 1 | \theta^{(t)})$ = prior probability that observation $i$ comes from group 1
- $P(x_i | \theta^{(t)})$ = marginal probability of observing $x_i$ from any group

#### Step 3: Identifying Each Component

**Component 1**: $P(x_i | z_{i1} = 1, \theta^{(t)}) = f_1(x_i | \mu^{(t)}, \sigma^{2(t)})$

This is the probability density function of the normal distribution.

**Component 2**: $P(z_{i1} = 1 | \theta^{(t)}) = \pi_1^{(t)}$

This is the mixing proportion for group 1 - the prior probability that any observation comes from the normal distribution.

**Component 3**: $P(x_i | \theta^{(t)}) = \pi_1^{(t)} f_1(x_i | \mu^{(t)}, \sigma^{2(t)}) + \pi_2^{(t)} f_2(x_i | \alpha^{(t)}, \beta^{(t)})$

This is the marginal likelihood - the probability of observing $x_i$ from either group, weighted by the mixing proportions.

#### Step 4: Putting It All Together

Substituting back into Bayes' theorem:

$$\gamma_{i1} = \frac{f_1(x_i | \mu^{(t)}, \sigma^{2(t)}) \cdot \pi_1^{(t)}}{\pi_1^{(t)} f_1(x_i | \mu^{(t)}, \sigma^{2(t)}) + \pi_2^{(t)} f_2(x_i | \alpha^{(t)}, \beta^{(t)})}$$

Rearranging the numerator:

$$\gamma_{i1} = \frac{\pi_1^{(t)} f_1(x_i | \mu^{(t)}, \sigma^{2(t)})}{\pi_1^{(t)} f_1(x_i | \mu^{(t)}, \sigma^{2(t)}) + \pi_2^{(t)} f_2(x_i | \alpha^{(t)}, \beta^{(t)})}$$

Similarly, for group 2:

$$\gamma_{i2} = \frac{\pi_2^{(t)} f_2(x_i | \alpha^{(t)}, \beta^{(t)})}{\pi_1^{(t)} f_1(x_i | \mu^{(t)}, \sigma^{2(t)}) + \pi_2^{(t)} f_2(x_i | \alpha^{(t)}, \beta^{(t)})}$$

#### Step 5: Key Insight

Notice that both formulas have the same denominator - this is the marginal likelihood that ensures the probabilities sum to 1:
$$\gamma_{i1} + \gamma_{i2} = 1$$

This makes sense because each observation must come from exactly one of the two groups.

### M-step: Parameter Updates

**1. Mixing Proportions** (same as before):
$$\pi_1^{(t+1)} = \frac{1}{n}\sum_{i=1}^{n} \gamma_{i1}, \quad \pi_2^{(t+1)} = \frac{1}{n}\sum_{i=1}^{n} \gamma_{i2}$$

**2. Normal Distribution Parameters**:
$$\mu^{(t+1)} = \frac{\sum_{i=1}^{n} \gamma_{i1} x_i}{\sum_{i=1}^{n} \gamma_{i1}}$$

$$\sigma^{2(t+1)} = \frac{\sum_{i=1}^{n} \gamma_{i1} (x_i - \mu^{(t+1)})^2}{\sum_{i=1}^{n} \gamma_{i1}}$$

**3. Beta Distribution Parameters** (requires numerical optimization):

The beta parameters don't have closed-form solutions, so we need to solve:

$$\frac{\partial Q}{\partial \alpha} = \sum_{i=1}^{n} \gamma_{i2} \left[\log(x_i) - \psi(\alpha) + \psi(\alpha + \beta)\right] = 0$$

$$\frac{\partial Q}{\partial \beta} = \sum_{i=1}^{n} \gamma_{i2} \left[\log(1-x_i) - \psi(\beta) + \psi(\alpha + \beta)\right] = 0$$

Where $\psi(x) = \frac{d}{dx}\log\Gamma(x)$ is the digamma function.

### Example: Mixed Rating Data

Suppose we observe these ratings: $\{0.2, 0.8, 7.5, 0.3, 8.2, 0.9, 6.1, 0.1\}$

**Initial Guess**:
- Group 1 (Normal): $\mu = 7.0$, $\sigma = 1.0$, $\pi_1 = 0.5$
- Group 2 (Beta): $\alpha = 2.0$, $\beta = 2.0$, $\pi_2 = 0.5$

**E-step for rating 0.2**:
- Normal probability: $0.5 \times f_1(0.2 | 7.0, 1.0) = 0.5 \times 0.0001 = 0.00005$
- Beta probability: $0.5 \times f_2(0.2 | 2.0, 2.0) = 0.5 \times 1.2 = 0.6$

So $\gamma_{i2} = \frac{0.6}{0.00005 + 0.6} = 0.9999$ (almost certainly from beta distribution)

**E-step for rating 7.5**:
- Normal probability: $0.5 \times f_1(7.5 | 7.0, 1.0) = 0.5 \times 0.35 = 0.175$
- Beta probability: $0.5 \times f_2(7.5 | 2.0, 2.0) = 0.5 \times 0 = 0$ (beta is bounded [0,1])

So $\gamma_{i1} = \frac{0.175}{0.175 + 0} = 1.0$ (definitely from normal distribution)

### Key Insights

1. **Automatic Classification**: The algorithm automatically learns which observations come from which distribution
2. **Flexible Framework**: Works with any combination of distributions
3. **Boundary Detection**: Observations outside the beta range [0,1] are automatically assigned to the normal group
4. **Parameter Learning**: Each distribution's parameters are learned separately based on the observations assigned to it

### Why This Matters

Mixed distribution models are common in practice:
- **Finance**: Stock returns (normal) vs. default probabilities (beta)
- **Biology**: Gene expression levels (normal) vs. proportions (beta)
- **Marketing**: Continuous metrics (normal) vs. conversion rates (beta)

The EM algorithm provides a unified framework to handle these complex, real-world scenarios.

### Derivation of M-step Updates

Starting with the expected log-likelihood:

$$Q(\theta | \theta^{(t)}) = \sum_{i=1}^{n} \sum_{k=1}^{2} \gamma_{ik} \log[\pi_k f(x_i | \mu_k, \sigma_k^2)]$$

$$= \sum_{i=1}^{n} \sum_{k=1}^{2} \gamma_{ik} [\log \pi_k + \log f(x_i | \mu_k, \sigma_k^2)]$$

For the mean $\mu_k$, taking the derivative with respect to $\mu_k$:

$$\frac{\partial Q}{\partial \mu_k} = \sum_{i=1}^{n} \gamma_{ik} \frac{\partial}{\partial \mu_k} \log f(x_i | \mu_k, \sigma_k^2)$$

$$= \sum_{i=1}^{n} \gamma_{ik} \frac{\partial}{\partial \mu_k} \left[-\frac{1}{2}\log(2\pi\sigma_k^2) - \frac{(x_i - \mu_k)^2}{2\sigma_k^2}\right]$$

$$= \sum_{i=1}^{n} \gamma_{ik} \frac{x_i - \mu_k}{\sigma_k^2}$$

Setting equal to zero:

$$\sum_{i=1}^{n} \gamma_{ik} \frac{x_i - \mu_k}{\sigma_k^2} = 0$$

$$\sum_{i=1}^{n} \gamma_{ik} (x_i - \mu_k) = 0$$

$$\sum_{i=1}^{n} \gamma_{ik} x_i = \mu_k \sum_{i=1}^{n} \gamma_{ik}$$

$$\mu_k = \frac{\sum_{i=1}^{n} \gamma_{ik} x_i}{\sum_{i=1}^{n} \gamma_{ik}}$$

## Complete EM Algorithm

1. **Initialize** parameters $\theta^{(0)}$
2. **E-step**: Compute $\gamma_{ik} = E[z_{ik} | x_i, \theta^{(t)}]$
3. **M-step**: Update parameters $\theta^{(t+1)} = \arg\max_{\theta} Q(\theta | \theta^{(t)})$
4. **Check convergence**: If $|\ell(\theta^{(t+1)}) - \ell(\theta^{(t)})| < \epsilon$, stop; otherwise, set $t = t+1$ and return to step 2

## Convergence Properties

The EM algorithm guarantees that the log-likelihood increases at each iteration:
$$\ell(\theta^{(t+1)}) \geq \ell(\theta^{(t)})$$

This property ensures convergence to a local maximum of the likelihood function.

## Summary: What You Need to Remember

### The EM Algorithm in One Sentence
**The EM algorithm is a smart way to find hidden groups in your data by making educated guesses and then improving those guesses over and over again.**

### The Two Steps
1. **E-step**: "Which group does each data point probably belong to?"
2. **M-step**: "What should each group look like based on these probabilities?"

### Why It Works
- **It's iterative**: Each step makes the groups clearer
- **It's guaranteed**: The log-likelihood always improves (or stays the same)
- **It's flexible**: Works with any type of data distribution

### When to Use It
- **Missing data**: When you have incomplete information
- **Hidden groups**: When you suspect there are patterns you can't see directly
- **Mixture models**: When your data comes from multiple sources
- **Classification**: When you want to automatically group similar items

### Real-World Examples
- **Netflix**: Grouping users by movie preferences
- **Medicine**: Identifying different patient types
- **Finance**: Detecting different market behaviors
- **Biology**: Classifying different cell types

### The Bottom Line
The EM algorithm is like having a smart assistant that can look at messy, incomplete data and figure out the hidden patterns. It's not magic—it's just very good at making educated guesses and then improving them systematically!

